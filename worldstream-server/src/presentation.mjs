import { createHash } from 'node:crypto';
import { NAMEABLE } from './cast.mjs';
import { daypart } from './sky.mjs';
import { RULES_VERSION } from './fixture.mjs';
import { londonClock, londonDate } from './time.mjs';
import { findSpoilers } from './spoilers.mjs';

// Phase C. A model is allowed to write, and allowed to write nothing else.
//
// The whole of the safety rail is one sentence, and it is architectural rather
// than a matter of prompting well: **the event already happened before this
// file runs**. Everything here reads a committed public event out of the world
// and turns it into prose. Nothing here is imported by the world, the fixture,
// the reducer or the server's write path; nothing here can create an event,
// change a fact, move a relationship or influence a single decision the
// deterministic engine makes. If every function below returned garbage, or
// threw, or the network were unplugged, the world would run identically and the
// feed would read exactly as it did in v12.
//
// So the model is not a showrunner and not even a director. The director chose
// what happens. The engine committed it. This decorates it, afterwards, and if
// the decoration fails validation it is thrown away and the canonical sentence
// is shown instead. That fallback is not an error path — it is the normal state
// of this world, because presentation is off unless somebody turns it on.
export const PROMPT_VERSION = 'presentation-v1';
export const DEFAULT_MODEL = 'gpt-5.6-terra';
export const MAX_CHARS = 700;
export const MAX_LINES = 6;

// A canonical brief. Pure, derived only from what the public projection already
// shows, and the single thing a model is ever given. It carries no private
// state: no knowledge, no memory, no relationship value, no arrangement, no
// reason. A vignette therefore cannot disclose anything the feed does not,
// because the writer of it was never told anything the feed does not say.
// londonClock returns the wall clock as {hour, minute}, which is what the
// opening-hours rules want and not what a heading wants.
const hhmm = ms => {const {hour,minute}=londonClock(ms);
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;};
export function canonicalBrief(event,projection) {
  return {
    eventId:event.id,
    occurredAt:event.occurredAt,
    londonDate:londonDate(event.occurredAt),
    londonTime:hhmm(event.occurredAt),
    // Both of these are properties of the event, never of the snapshot it was
    // read from. Taking them from the projection meant a day's worth of events
    // all inherited whatever room the pair ended the day in, and whatever
    // daypart it was when somebody looked — so breakfast happened "in the
    // quarters" at "night".
    daypart:daypart(event.occurredAt),
    location:event.location,
    room:event.room??null,
    participants:[...event.participants],
    // The canonical sentence. This is the fact. Prose may re-say it; prose may
    // not replace, extend, contradict or add to it.
    fact:event.description,
    weather:projection.weather?{code:projection.weather.code,description:projection.weather.description,
      temperatureC:projection.weather.temperatureC}:null,
    factions:projection.factions??null,
    // Authored dialogue, when the event is one of the world's own conversations.
    // It is supplied so a vignette can set a scene the written lines then play
    // inside — never so a model can rewrite them.
    lines:Array.isArray(event.lines)?event.lines.map(line=>({who:line.who,text:line.text})):null,
  };
}
// A stable identity for a rendering. Changing the rules, the prompt or the
// canonical sentence produces a different key, so a cached vignette can never
// outlive the fact it was written about.
export const briefKey = brief => createHash('sha256')
  .update(`${RULES_VERSION}|${PROMPT_VERSION}|${brief.eventId}|${brief.fact}`).digest('hex').slice(0,32);

// Every proper noun this world is allowed to say out loud. A capitalised word
// that is not in here, and is not simply starting a sentence, is somebody or
// somewhere the model invented — which is the failure mode that matters, since
// an invented colleague reads exactly like a canon one to a reader who does not
// know the book.
export const ALLOWED_NOUNS = Object.freeze([...NAMEABLE,
  'MI6','MEU','London','Westminster','Sanctuary','Streamliner','Thames',
  'Enchanted Ink','Silver Spoon','Silver Spoon Cafe','New Big Ben','Big Ben',
  'Chimes of Renewal','Celestial Veil','Veil','Holy Order','Order','Church','Holy Item','Holy Items',
  'Armoured-dillo','Guardian','Guardians','Onari',
  'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
  'January','February','March','April','May','June','July','August','September','October','November','December']);
// Things this world may not say at all. The list used to live here, with a
// second copy in the canon suite and a third in the Legion suite, and they had
// already drifted apart. It lives in one place now — and it had to, because
// when the author retired the severity rail in v15 this became the only thing
// standing between a running world and Book One's reveals.
export { findSpoilers, isClean, assertNoSpoiler, REVEALS } from './spoilers.mjs';
const SENTENCE_START = /(^|[.!?…]["'”’)\]]?\s+|[\n\r]\s*|[-—*]\s+|["'“‘([]\s*)$/;
// Capitalised tokens that are not merely opening a sentence. Multi-word runs
// are kept whole so "New Big Ben" is checked as itself rather than as three
// separate mystery words.
// Checked longest first, so a name that contains a shorter allowed name is
// recognised as itself rather than being eaten a word at a time.
const LONGEST_FIRST = [...ALLOWED_NOUNS].sort((a,b)=>b.split(/\s+/).length-a.split(/\s+/).length||b.length-a.length);
export function properNouns(text) {
  const found=new Set(), pattern=/\b[A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*)*\b/g;
  for(const match of text.matchAll(pattern)) {
    // See the loop below: an allowed name is matched before the sentence-start
    // rule gets to discard a word, because "Agent Davis says something" opens
    // with a name whose first word is also the first word of the sentence.
    // "15°C" is a temperature, not somebody called C. A word boundary sits
    // before that capital, so without this every vignette that mentioned the
    // weather was rejected for inventing a person — which is precisely what
    // twenty of the first twenty-four live renderings were rejected for.
    if(text[match.index-1]==='°') continue;
    const words=match[0].split(/\s+/);
    const opensSentence=SENTENCE_START.test(text.slice(0,match.index));
    let index=0;
    while(index<words.length) {
      // Prefer the longest allowed run that starts here, so a known multi-word
      // name is matched before its first word is reported as unknown. Longest
      // genuinely matters: taking the first match in list order consumed
      // "Silver Spoon" out of "Silver Spoon Cafe" and then reported the
      // leftover "Cafe" as an invented place.
      // A possessive is the same name wearing an apostrophe. Without stripping
      // it, "the Church's preparations" reported an invented place called
      // Church-apostrophe-s and threw away an otherwise perfect vignette.
      const run=words.slice(index).join(' ').replace(/['’]s\b/g,'');
      const known=LONGEST_FIRST.find(noun=>run===noun||run.startsWith(noun+' '));
      if(known) {index+=known.split(/\s+/).length; continue;}
      // A sentence's first word is capitalised because it is first — but only
      // once the run starting there has failed to be a name. Discarding it
      // first threw away the "Agent" of "Agent Davis says something" and then
      // reported the surname as an invented person.
      if(index===0&&opensSentence) {index++; continue;}
      found.add(words[index].replace(/['’]s$/,'').replace(/[^A-Za-z'’-]/g,''));
      index++;
    }
  }
  return [...found].filter(Boolean);
}
// The gate every rendered vignette passes before anybody sees it. It is
// deliberately unforgiving: a rejected vignette costs nothing, because the
// canonical sentence is always there to fall back to.
export function validateVignette(text,brief) {
  if(typeof text!=='string'||!text.trim()) return {ok:false,reason:'empty'};
  const prose=text.trim();
  if(prose.length>MAX_CHARS) return {ok:false,reason:'too_long'};
  if(prose.split(/\n+/).filter(line=>line.trim()).length>MAX_LINES) return {ok:false,reason:'too_many_lines'};
  const spoilers=findSpoilers(prose);
  if(spoilers.length) return {ok:false,reason:`embargoed:${spoilers[0].match}`};
  if(/https?:\/\/|^#|\*\*/m.test(prose)) return {ok:false,reason:'markup'};
  const unknown=properNouns(prose);
  if(unknown.length) return {ok:false,reason:`invented_name:${unknown.slice(0,3).join(',')}`};
  // At least one of the people who were there, so a vignette cannot drift off
  // its own subject. Requiring *all* of them was worse than useless: on an
  // event whose subject is a colleague, it forced the pair into a sentence
  // that was not about them, and the model obliged by handing Davis's remark
  // to Ashai. Naming nobody is drift; naming one is a scene.
  if(brief.participants.length&&!brief.participants.some(id=>prose.includes(id==='goaden'?'Goaden':'Ashai')))
    return {ok:false,reason:`missing_participant:${brief.participants.join('+')}`};
  return {ok:true,reason:null};
}

// What the model is told. The instruction is mostly a list of refusals, because
// the job is small: the facts are settled and the only open question is how the
// sentence sounds.
export const SYSTEM_PROMPT = [
  'You write short ambient prose for a fantasy-London serial. You are given one event that has already happened.',
  'Your only job is to render that event as prose. You never decide what happened.',
  'Rules, all absolute:',
  '- Do not add events, causes, consequences, decisions, revelations or foreshadowing. The fact you are given is the whole of what occurred.',
  '- Name no person or place except the ones in the brief. Invent no colleagues, no ranks, no venues, no organisations.',
  '- Do not state or imply what anyone knows, remembers, intends, suspects or feels about the plot. Ordinary mood is fine; motive is not.',
  '- No prophecy, no destiny, no secrets, no hidden meaning, no cliffhanger. This is an ordinary day in a working life.',
  '- Present tense or past tense, third person, British English. Two to four sentences, or up to four lines of dialogue.',
  '- People listed as present may be named, but only doing what the event says they did. If the event does not say they did',
  '  anything, they were there and nothing more. Never give one of them an action the event assigns to another person,',
  '  and never turn an unnamed person in the event into a named one.',
  '- At least one named character must appear. Plain prose only: no markdown, headings, lists or links.',
  'The time, the room and the weather are context for the scene, not things to announce. Never open with the timestamp,',
  'never restate the temperature, and mention the weather only where it is doing something. Write the moment, not the metadata.',
].join('\n');
// The public names of the six places, so a brief never hands a model a raw id
// to put in a sentence. It produced prose that opened "At mi6, the night sits
// quietly against the windows".
const LOCATION_NAMES = Object.freeze({mi6:'MI6',sanctuary:'the Sanctuary',streamliner:'the Streamliner',
  enchanted_ink:'Enchanted Ink',cafe:'the Silver Spoon Cafe',big_ben_plaza:'the New Big Ben plaza'});
const DAYPART_WORDS = Object.freeze({small_hours:'the small hours',morning:'morning',
  midday:'the middle of the day',evening:'evening',night:'night'});
export function userPrompt(brief) {
  const parts=[`Canonical event (this is fact, and all of it): ${brief.fact}`,
    // Spelled out, because a 24-hour clock read as a 12-hour one turned a
    // mid-morning piano practice into "10:18 p.m." and a working afternoon
    // into the middle of the night.
    `When: ${brief.londonTime} on a 24-hour clock — ${DAYPART_WORDS[brief.daypart]??brief.daypart} on ${brief.londonDate}.`,
    `Where: ${brief.room??LOCATION_NAMES[brief.location]??brief.location}, at ${LOCATION_NAMES[brief.location]??brief.location}.`,
    `Present, as observers unless the event says otherwise: ${brief.participants.length
      ?brief.participants.map(id=>id==='goaden'?'Goaden':'Ashai').join(' and '):'nobody named'}.`];
  if(brief.weather) parts.push(`Weather, as background only: ${brief.weather.description.toLowerCase()}, ${brief.weather.temperatureC}°C.`);
  if(brief.lines?.length) parts.push('These lines were actually spoken and are canon. Do not rewrite them; you may set the scene around them:\n'
    +brief.lines.map(line=>`${line.who==='goaden'?'Goaden':'Ashai'}: ${line.text}`).join('\n'));
  parts.push('Write the vignette.');
  return parts.join('\n');
}
export const VIGNETTE_SCHEMA = Object.freeze({
  type:'object',
  properties:{
    prose:{type:'string',description:'The vignette. Two to four sentences, or up to four lines of dialogue.'},
    // The model is made to declare who it named. The prose is then scanned
    // independently, so this field is a cross-check rather than a source of
    // truth: a model that under-reports here is caught by the scan anyway.
    namedEntities:{type:'array',items:{type:'string'},description:'Every proper noun used in the prose.'},
  },
  required:['prose','namedEntities'], additionalProperties:false,
});

// The default transport. Written against the Responses API directly with the
// platform's own fetch, because this project ships with no dependencies and
// adding an SDK for one POST would be the largest change in it.
export function openAIClient({apiKey,model=DEFAULT_MODEL,fetchImpl=globalThis.fetch,timeoutMs=30_000}={}) {
  if(!apiKey) throw new TypeError('An API key is required');
  return async function render({system,user}) {
    const abort=AbortSignal.timeout(timeoutMs);
    const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',signal:abort,
      headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({model,input:[{role:'system',content:system},{role:'user',content:user}],
        text:{format:{type:'json_schema',name:'silver_clouds_vignette',schema:VIGNETTE_SCHEMA,strict:true}}})});
    if(!response.ok) throw new Error(`Presentation request failed: ${response.status}`);
    const body=await response.json();
    const text=body.output_text
      ??body.output?.flatMap(item=>item.content??[]).find(part=>part.type==='output_text')?.text;
    if(!text) throw new Error('Presentation response carried no text');
    return JSON.parse(text);
  };
}
// Presentation is off unless it is switched on and given a key. Two separate
// conditions on purpose: a key sitting in the environment for some other tool
// must not quietly start sending this world's events to a third party.
export function presentationEnabled(env=process.env) {
  return env.SILVER_CLOUDS_PRESENTATION==='on'&&Boolean(env.OPENAI_API_KEY);
}
// Render one committed event. Every failure — disabled, no client, a network
// error, a refused validation — lands in the same place: the canonical sentence,
// unchanged, which is what the feed would have shown anyway.
export async function renderVignette(brief,{client,onReject}={}) {
  if(!client) return {prose:brief.fact,source:'canonical',reason:'disabled'};
  let result;
  try { result=await client({system:SYSTEM_PROMPT,user:userPrompt(brief)}); }
  catch(error) { return {prose:brief.fact,source:'canonical',reason:`error:${error.message}`}; }
  const prose=typeof result?.prose==='string'?result.prose.trim():'';
  const verdict=validateVignette(prose,brief);
  if(!verdict.ok) { onReject?.({brief,prose,reason:verdict.reason});
    return {prose:brief.fact,source:'canonical',reason:verdict.reason}; }
  // A declared entity outside the allowlist is a rejection even when the scan
  // let the prose through, because the model saying it used a name it should
  // not have is evidence enough.
  // Compared without case, because a model that writes "MI6" and then declares
  // it as "mi6" has done nothing wrong and was being refused for it.
  const declared=(result.namedEntities??[]).map(name=>String(name).trim()).filter(name=>name
    &&!ALLOWED_NOUNS.some(noun=>{const a=name.toLowerCase(),b=noun.toLowerCase();
      return a===b||b.includes(a)||a.includes(b);}));
  if(declared.length) { onReject?.({brief,prose,reason:`declared:${declared.join(',')}`});
    return {prose:brief.fact,source:'canonical',reason:`declared:${declared.join(',')}`}; }
  return {prose,source:'model',reason:null,key:briefKey(brief)};
}

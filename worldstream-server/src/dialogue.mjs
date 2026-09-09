import { createHash } from 'node:crypto';
import { londonDate, londonClock } from './time.mjs';

// Authored ambient dialogue for Goaden and Ashai. Nothing here is generated at
// runtime and no model is called: the world picks one of these written exchanges
// with a seeded hash, so the same day always plays the same scene.
//
// Voice comes from the Soul Sips narrative packet, which is drawn from the
// manuscript with page citations:
//
//   Goaden — "nah", "yo", "bro", "man", "oi"; short punchy lines; a laid-back
//   drawl with bite; humour by sarcasm and nonchalant dismissiveness. Under
//   affection he shows unspoken protectiveness and denies romance; under grief
//   he is stoic publicly and solitary privately; embarrassment reads as
//   nonchalance.
//
//   Ashai — "if you say so", "really?"; says "we" more than "I"; endings tilt
//   upward. Calm, she notices colour and living texture. Vulnerable, she asks
//   for the truth. Under authority she chafes at restrictive protection.
//
// That last pair is the engine of almost every scene below: she asks plainly and
// he turns it aside, and neither of them is wrong to.
//
// Three rules the packet sets for new material, followed here: no manuscript
// sentence is reused, an object or a detail opens rather than a lore dump, and
// nothing past the p.183 checkpoint is referenced — no family, no parentage, no
// later disclosure. Where a personal question would cross that line, the scene
// is his refusal to answer it, which reveals nothing at all.

// Plate keys. Ashai's come from her expression sheet; Goaden's from the
// replacement brief, so the writing decides the art rather than the reverse.
export const GOADEN_PLATES = Object.freeze(['idle','smirk','amused','deflect','guarded','concerned','surprised','tired']);
// Ashai's are the real bust filenames in the game's ashai-story folder, so a
// written line names an asset that exists rather than a wished-for one.
export const ASHAI_PLATES = Object.freeze(['neutral','soft_smile','amused','thoughtful','vulnerable','tired','surprised','guarded']);
export const MOODS = Object.freeze(['repair','strained','friction','sidelong','veil','weathered','close','ordinary']);

const g = (expression,text) => ({who:'goaden',expression,text});
const a = (expression,text) => ({who:'ashai',expression,text});
// Colleagues, not crew. Both have walked these corridors as ambient lines
// since v6 and now have plates, so they can be in the room properly — but
// only in the rooms and hours cast.mjs already says they can be.
const v = (expression,text) => ({who:'davis',expression,text});
const h = (expression,text) => ({who:'henderson',expression,text});

export const EXCHANGES = Object.freeze({
  // Nothing pressing. Small objects, small friction, no weight.
  ordinary:[
    [a('neutral','The lights on the east corridor still flicker. Nobody has been near them in a week.'),
     g('smirk','Nah, that isn\'t broken. That\'s ambience.'),
     a('soft_smile','If you say so.')],
    // A clock claim needs an actual continuous-wake history. The current world
    // can send them back to sleep after a night watch, so 'ordinary' alone is
    // no evidence for this exchange. Keep it authored but unavailable without
    // that explicit cause; the same conversation slot uses another script.
    { requires: 'both_up_since_five', lines: [g('idle','You\'ve been up since five.'),
     a('guarded','So have you.'),
     g('smirk','Yeah, but I carry it better.')] },
    [a('soft_smile','We should eat somewhere that isn\'t a canteen at some point.'),
     g('amused','Bold. Naming the place is the hard part.'),
     a('neutral','I\'ll name one. You only have to turn up.')],
    [g('tired','Long one.'),
     a('neutral','You said that yesterday.'),
     g('smirk','And I was right yesterday.')],
    // Treatment 102, "The Red-and-Black Jacket". Studio mode: quiet — "a modest
    // shared activity makes room for something a character cannot yet say
    // directly", ending on "an offered action, changed permission or unfinished
    // possibility". The jacket is the activity; nobody says why it matters.
    [a('thoughtful','That isn\'t a tear any more. That\'s a hole with opinions.'),
     g('idle','It\'s fine, mate.'),
     a('neutral','The lining is coming out of the cuff, Goaden.'),
     g('smirk','Then it\'s a vent, isn\'t it.'),
     a('amused','Get a new one.'),
     g('guarded','No.'),
     a('thoughtful','...Alright.'),
     g('idle','It isn\'t about the jacket.'),
     a('soft_smile','I know it isn\'t about the jacket. I didn\'t say anything.'),
     g('tired','You looked at me.'),
     a('amused','I looked at your cuff.')],
    [a('neutral','There\'s a woman on Cross Lane who mends without redesigning. I asked.'),
     g('surprised','You asked?'),
     a('neutral','I asked what she would do to it. She said as little as she could get away with.'),
     g('idle','...Go on then.'),
     a('amused','You\'ll have to wear something else for a fortnight.'),
     g('tired','I\'ve got the grey one.'),
     a('soft_smile','You hate the grey one.'),
     g('idle','I reckon I can hate it for a fortnight.')],
    [g('idle','It\'s back, yeah.'),
     a('surprised','And?'),
     g('smirk','She has left the burn on the shoulder.'),
     a('thoughtful','Was that the arrangement?'),
     g('idle','That was the arrangement. Stitched round it. You can see where it was and it won\'t go any further.'),
     a('soft_smile','Good.'),
     g('deflect','It\'s a jacket.'),
     a('amused','It\'s a jacket, yeah.')],
    // Treatment 48, "The Shift Nobody Wants". The fair rota is not the popular
    // one, and Goaden ends up on the duty he used to dodge.
    [a('thoughtful','Same four names. Every Thursday since February.'),
     g('idle','Because they don\'t moan, do they.'),
     a('neutral','Because they don\'t moan. That\'s the whole selection process and nobody chose it, it just settled.'),
     g('tired','You\'re going to fix it, aren\'t you.'),
     a('amused','I\'m going to make somebody look at it.'),
     g('smirk','Yeah, that\'s the same thing with better manners.')],
    [g('tired','I\'m on Thursdays, mate.'),
     a('soft_smile','You are.'),
     g('idle','I have never in my life been on Thursdays.'),
     a('amused','No. That was rather the point.'),
     g('guarded','I\'m not saying it\'s unfair.'),
     a('neutral','I know you\'re not.'),
     g('tired','I\'m saying it\'s Thursdays.')],
    [h('idle','Reeves.'),
     g('idle','Sir.'),
     h('waiting','You\'ve complained about this rota to four separate people.'),
     g('deflect','I\'ve mentioned it, yeah.'),
     h('idle','You\'ve mentioned it at volume. Are you asking to come off it?'),
     g('surprised','...Nah.'),
     h('waiting','No. I didn\'t think you were.'),
     g('smirk','I\'d just like it noted that it\'s Thursdays.'),
     h('idle','It\'s noted, Reeves. It\'s been noted in three departments.')],
  ],
  // Settled and close. This is where the personal questions live, and where he
  // declines them — the refusal is the scene, so nothing is disclosed.
  close:[
    [a('thoughtful','Can I ask you something, and you actually answer it?'),
     g('idle','Depends what it is, doesn\'t it.'),
     a('guarded','Have you ever been in love?'),
     g('deflect','Is the piano still open? The quiet is getting strange in here.'),
     a('neutral','That isn\'t an answer.'),
     g('smirk','It\'s the one you\'re getting.')],
    [a('soft_smile','You always sit where you can see the door.'),
     g('idle','Habit.'),
     a('guarded','It isn\'t a habit if you do it on purpose.'),
     g('deflect','Then it\'s a good one.')],
    [g('idle','You went quiet.'),
     a('thoughtful','I was listening to the building. It hums at night. A different note than the day.'),
     g('amused','Nah, you\'re making that up.'),
     a('soft_smile','Stand still for a second and you\'ll hear it.')],
    [a('soft_smile','We\'re alright, aren\'t we?'),
     g('surprised','Where has that come from?'),
     a('guarded','I ask when I want to know. That\'s all.'),
     g('idle','Yeah. We\'re alright.')],
    // Treatment 106, "The Plant on the Windowsill". Quiet mode again, but the
    // studio's improvement note applies: end on "a changed action, telling
    // object, specific reply or live uncertainty" rather than a summary.
    [g('surprised','What is that, mate.'),
     a('neutral','It was on the floor by the recycling in the west office. Nobody has watered it since about February.'),
     g('idle','So you\'ve adopted it.'),
     a('thoughtful','I\'ve moved it somewhere with a window.'),
     g('smirk','That\'s adopting it.'),
     a('amused','It\'s relocating it.')],
    [a('tired','It has dropped four leaves.'),
     g('idle','Rose say anything, yeah?'),
     a('neutral','Rose said less water and better light and stop moving it about. Then she said it wasn\'t going to be pretty for a while and I should leave it alone.'),
     g('surprised','That\'s it? She could just —'),
     a('guarded','She could. I didn\'t ask her to.'),
     g('idle','...Fair enough.')],
    [a('soft_smile','There\'s a new one.'),
     g('deflect','I was opening the window.'),
     a('amused','You\'ve been opening that window every morning for six weeks.'),
     g('idle','It gets stuffy in there.'),
     a('soft_smile','It does.'),
     g('smirk','Where?'),
     a('amused','Left side. Under the big one.'),
     g('idle','...Right. Yeah. There it is.')],
    // Treatment 101, "A Letter Left Unsent". She refuses to polish an evasion.
    // The studio's quiet mode allows "a small disclosure, refusal or mismatch";
    // this is the refusal.
    [a('tired','He has rewritten it four times and it\'s worse every time.'),
     g('idle','Worse how, though?'),
     a('neutral','The first one said what he did. This one says what was going on for him at the time, and by paragraph three the other person is being unreasonable about it.'),
     g('smirk','So he wants you to make it sound better. Course he does.'),
     a('guarded','He wants me to make it sound honest, which isn\'t the same job and he knows it.'),
     g('idle','What did you say?'),
     a('neutral','That I\'d help him write it. Not help him get out of it.'),
     g('amused','Yeah, bet that went down well.'),
     a('tired','He hasn\'t been back.')],
    [a('thoughtful','He came back.'),
     g('surprised','Did he, yeah?'),
     a('neutral','Four lines. No explanation in any of them. He read it out and then said he wasn\'t going to ask her to reply.'),
     g('idle','And has she?'),
     a('vulnerable','No.'),
     g('idle','...'),
     a('soft_smile','He\'s doing the shifts at the shelter on Cross Lane instead. He didn\'t tell me that, the woman on the desk did.'),
     g('smirk','That isn\'t nothing.'),
     a('neutral','It isn\'t nothing. It isn\'t the letter either. Both are true.')],
    // Treatment 98, "The Eye Appointment". Canon, physical PDF page 153: "But
    // don't worry, they gave me a new bionic eye." The world already seeds
    // ashai:own_eye_replacement and goaden:eye_disclosure from that page, so
    // this adds no fact — it uses one.
    //
    // Studio aftermath mode, avoid list: "A caretaker deciding everything for
    // the person receiving care." The whole story is him assuming, and the fix
    // being that he asks. No upgrade is found and nothing is unlocked.
    [g('idle','What time\'s the appointment, then?'),
     a('neutral','Ten past two.'),
     g('idle','Right, yeah.'),
     a('thoughtful','...You don\'t have to.'),
     g('deflect','Never said I was.'),
     a('soft_smile','You\'ve cleared your afternoon.'),
     g('guarded','I\'ve got things on.'),
     a('amused','You\'ve got nothing on.')],
    [a('guarded','You were in the waiting room.'),
     g('idle','I was passing.'),
     a('tired','Goaden, it\'s on the fourth floor of a building you have no reason to be in.'),
     g('deflect','Thought you\'d want somebody there.'),
     a('neutral','I might have. I hadn\'t decided.'),
     g('surprised','That\'s the same thing.'),
     a('guarded','It really isn\'t. You decided for me and then you were in the chair opposite and I couldn\'t say anything about it without doing it in front of a technician.'),
     g('tired','...Yeah. Alright.'),
     a('soft_smile','It\'s not a telling-off.'),
     g('smirk','It\'s a bit of a telling-off.')],
    [a('neutral','Second one\'s Thursday.'),
     g('idle','Yeah, okay.'),
     a('thoughtful','Meet me outside after. Not in it.'),
     g('surprised','...Outside.'),
     a('soft_smile','Outside. Quarter to four, by the railings.'),
     g('idle','I can do that, yeah.'),
     a('amused','I know you can do it. I\'m interested in whether you can do only that.'),
     g('smirk','Harsh.'),
     a('soft_smile','Quarter to four.')],
    [g('idle','How was it, then.'),
     a('neutral','Fine. Same as every six months. They looked at it, said the word stable four times and sent me away.'),
     g('idle','Good, yeah.'),
     a('thoughtful','You didn\'t ask if anything was different.'),
     g('smirk','Was anything different?'),
     a('amused','No.'),
     g('idle','Then I asked the right question.')],
  ],
  // Something outside has them worried. She asks straight; he goes short.
  //
  // NOTE FOR LATER INVESTIGATION — not built in this pass.
  //
  // Two of these four look like an escalation family rather than four
  // unrelated strained evenings:
  //
  //   "Every time it goes off, you go quiet."  /  "Nothing to say until there is."
  //   "You do not get to decide what I'm allowed to hear about..."
  //
  // The first states the pattern of withholding; the second is what happens
  // when the pattern has gone on too long. They are currently drawn
  // independently by hash, so the payoff can precede its own setup, and a
  // reader can meet the escalation without ever having met the grievance.
  //
  // The shape that would fix it is an ordered family — an exchange may declare
  // that another exchange has already played between these two — which is the
  // same mechanism the Moment Engine calls a callback seed. It is deliberately
  // not built here: it wants designing across all the moods at once rather
  // than bolted onto `strained`, and the gating work in this pass is the
  // prerequisite for it, not a substitute.
  strained:[
    [a('vulnerable','You were gone four hours.'),
     g('tired','Standby is mostly standing about.'),
     a('guarded','Mostly.'),
     g('deflect','Oi. I\'m here, am I not?')],
    // The autonomy confrontation. Gated, and the gate is the point.
    //
    // The line is canon-correct and stays exactly as written: Ashai swears in
    // Book One and swears specifically at being managed — "Like I'm made of
    // fucking glass" [P00065], "so you're all jealous and protective now?"
    // [P02190]. Both are her reacting to somebody deciding on her behalf.
    //
    // What was wrong was never the words. It was that knowledge asymmetry
    // (Goaden knowing something from a routine standby shift or courier delivery)
    // was treated as withholding: an audit found this firing without Goaden
    // ever having lied, concealed danger, broken an agreement, or made a
    // unilateral decision for Ashai. Knowledge asymmetry is not evidence of
    // that. For Ashai to snap with this intensity, Goaden must have committed
    // an actual, intentional boundary violation (e.g. CONCEALED_DANGER,
    // BROKEN_AGREEMENT, or CONSEQUENTIAL_DECEPTION) with provenance in the
    // world ledger. Without such a committed event, strained conversations
    // select the calibrated milder exchanges below.
    //
    // On the performance tags: there is no eruption plate. The eight files in
    // `ashai-*.png` are the whole vocabulary and none of them is anger, so the
    // truest available reading is `vulnerable` — canon's eruptions come out of
    // suppressed hurt rather than temper, and `guarded` is a held-in tag on a
    // line that is the opposite of held in. The setup line moves to `tired`
    // both to avoid doubling `vulnerable` and because "all week" is weariness.
    // An `ashai-sharp` plate would be better than either; see AUDIT notes.
    { requires: 'autonomy_breach', lines: [
      a('tired','The scanners have been going all week.'),
      g('guarded','They do that.'),
      a('vulnerable','You do not get to decide what I\'m allowed to hear about. That isn\'t your fucking call.'),
      g('concerned','That\'s fair.')] },
    [g('guarded','Stay off the river side for a bit, yeah?'),
     a('guarded','Is that MI6 talking, or you?'),
     g('idle','Me, yeah.'),
     a('vulnerable','Then tell me why, and I\'ll listen.'),
     g('deflect','Just stay off it, Ash. Please.')],
    [a('vulnerable','Every time it goes off, you go quiet.'),
     g('tired','Nothing to say until there is.'),
     a('soft_smile','There\'s always something. We could start with: that was bad.'),
     g('smirk','That was bad.')],
  ],
  // Friction between them specifically. Small, and it does not resolve neatly.
  friction:[
    [g('idle','You\'ve been clipped with me all afternoon.'),
     a('guarded','You moved my evening without asking.'),
     g('surprised','I moved it back an hour!'),
     a('guarded','Without asking.')],
    [a('guarded','You could have just said no.'),
     g('smirk','I did say no.'),
     a('neutral','You said "nah" and walked off. Those aren\'t the same bloody thing.')],
    [g('concerned','Alright. Out with it.'),
     a('guarded','It\'s nothing.'),
     g('idle','You do the thing with your jaw when it\'s nothing.'),
     a('soft_smile','It will keep.')],
    [a('guarded','I\'m not fragile.'),
     g('guarded','Never said you were.'),
     a('neutral','You act like it, and that\'s a damn sight louder than saying it.')],
    // Treatment 44, "The Leave Form". She keeps approved time, and the boundary
    // is the story. Henderson is the one who has to make the staffing decision
    // instead of the easy ask. [P00605] is him at full volume about detail.
    [a('tired','That\'s the third time they\'ve asked.'),
     g('guarded','Say no, then.'),
     a('neutral','I have said no. Twice politely and once properly, and it\'s come back with a different name on it.'),
     g('smirk','Want me to make a scene?'),
     a('amused','God, no. You\'d enjoy it far too much.'),
     g('idle','I would, yeah.'),
     a('thoughtful','I\'m going to make them staff it instead.')],
    [h('idle','Bennet. They\'ve asked you again.'),
     a('neutral','They have.'),
     h('idle','And?'),
     a('guarded','And the leave was approved in March, sir.'),
     h('waiting','It was.'),
     a('neutral','I\'m not surrendering it because I\'m good with people. That\'s not a rota, that\'s a habit.'),
     h('idle','...No. It isn\'t.'),
     a('surprised','Sir?'),
     h('waiting','I\'ll staff it. Take your leave. And put that sentence in writing, would you, because I intend to use it on somebody else.')],
    [g('surprised','He said what?'),
     a('amused','He said he\'d use it on somebody else.'),
     g('smirk','He\'s nicking your line.'),
     a('soft_smile','He\'s nicking my line and staffing the shift. He can have the line.')],
  ],
  // After the world broke something they had arranged.
  repair:[
    [g('tired','Sorry about last night.'),
     a('neutral','You didn\'t pick it.'),
     g('idle','Still cost you an evening.'),
     a('soft_smile','Then we take one back. Tonight.')],
    [a('guarded','You didn\'t message.'),
     g('deflect','There wasn\'t much to say.'),
     a('vulnerable','Two words. "Still breathing" would have bloody done.'),
     g('concerned','...Yeah. Alright. That\'s fair.')],
    [g('idle','The halls will still be there.'),
     a('soft_smile','They will. So will we.'),
     g('smirk','That was almost nice.')],
    [a('neutral','Same plan. No callout this time.'),
     g('amused','You can\'t just declare that.'),
     a('soft_smile','Watch me.')],
    // Treatment 108, "The Apology With the Wrong Food". The studio's banter
    // mode warns against "stopping the shared activity for a long explanation
    // of camaraderie" — so the gift lands, gets refused as a substitute, and
    // the actual conversation happens anyway.
    [g('deflect','Oi. Brought you something.'),
     a('surprised','...That\'s a lot of pickle.'),
     g('idle','You like pickle, mate.'),
     a('amused','Yukon likes pickle. Yukon talks about pickle. You\'ve brought me Yukon.'),
     g('tired','Ah.'),
     a('soft_smile','It\'s a nice thought wrapped round the wrong man.'),
     g('smirk','Do you want it or not.'),
     a('amused','Obviously I want it. It isn\'t doing the other thing, though.'),
     g('idle','I know it isn\'t doing the other thing.')],
    [a('neutral','You said eight.'),
     g('guarded','I know what I said.'),
     a('neutral','I\'m not doing a speech. I sat there until twenty to ten.'),
     g('tired','Yeah.'),
     a('thoughtful','So do not say eight. Say you\'ll try for eight and I\'ll bring a book.'),
     g('idle','...That\'s worse, that.'),
     a('amused','It\'s honest. You\'ll hate it and it will work.'),
     g('smirk','Fine. I\'ll try for eight.'),
     a('soft_smile','And I\'ll bring a book.')],
    [g('idle','Here. Go on.'),
     a('surprised','That\'s the marmalade one.'),
     g('deflect','They had a load of them, mate.'),
     a('amused','They didn\'t have a load of them. They do three on a Thursday.'),
     g('smirk','Do you want it or not.'),
     a('soft_smile','Sit down, Goaden.')],
  ],
  // They passed somebody today. Not an argument and not a worry — the specific
  // flatness of a building full of colleagues, where the person who went by is
  // a fact you both register and neither of you says much about. Nothing here
  // names what Davis did or replays it: at this checkpoint that is simply
  // something Ashai carries and Goaden mostly declines to poke.
  sidelong:[
    [a('neutral','She looked straight through me in the corridor.'),
     g('idle','That\'s her whole thing.'),
     a('guarded','It\'s a choice, though. She chooses it.'),
     g('smirk','And you noticed, so it worked. Do not give it the rest of your evening.')],
    [g('amused','You went very still when she went past.'),
     a('guarded','I did not.'),
     g('idle','You did. It\'s fine. I\'m not going to make it a thing.'),
     a('soft_smile','Good.')],
    [a('thoughtful','Half this building has never said a word to me.'),
     g('idle','Half this building has never said a word to anyone.'),
     a('soft_smile','That\'s almost comforting.'),
     g('smirk','I have my moments.')],
    [g('tired','Corridors were busy.'),
     a('neutral','They were. Everyone somewhere else to be.'),
     g('idle','Suits me.'),
     a('soft_smile','You would say that in an empty one too.')],
    // Treatment 41, "Davis Is Right This Time". [P00170]: "Agent Davis eyed
    // Ashai with a thinly veiled rivalry that promised sparks." The rivalry is
    // canon and it is professional — so this is the version where Davis is
    // right, which costs Ashai more than being undermined would have.
    [v('idle','You\'re holding the Cross Lane job.'),
     a('guarded','On whose word?'),
     v('idle','Mine. The witness has the van leaving north and the tyre marks say it reversed.'),
     a('neutral','And you brought that to the room rather than to me.'),
     v('closeup','I brought it to the room because the room was where it needed saying.'),
     a('tired','Right.'),
     v('idle','You\'d have done the same.'),
     a('guarded','I\'d have told me first.')],
    [a('tired','She\'s right.'),
     g('surprised','Come again? Nah.'),
     a('neutral','I went and stood in it myself. The marks are reversing marks. She\'s right and I spent two days assuming she wasn\'t.'),
     g('idle','You going to tell her?'),
     a('guarded','Yes.'),
     g('smirk','Out loud, yeah?'),
     a('amused','Out loud, once, and then I\'m never mentioning it again as long as I live.')],
    [a('neutral','You were right about the van.'),
     v('idle','I know.'),
     a('amused','That\'s it?'),
     v('closeup','What did you want, Bennet, a speech? You\'d have hated a speech.'),
     a('soft_smile','...Fair.'),
     v('idle','I\'ll take it in credit on the report.'),
     a('guarded','You\'ll take it accurately on the report.'),
     v('idle','Accurately, then.'),
     a('neutral','Good.')],
    [g('idle','You two are getting on.'),
     a('guarded','We\'re not getting on.'),
     g('amused','You said good morning to her.'),
     a('tired','I said morning. There was no good in it.')],
  ],
  // The Veil close enough to be the thing everyone is talking about. Neither of
  // them has been to one at the Sanctuary — nobody has, it has never been held
  // there — so the anticipation is the whole of it.
  veil:[
    [a('soft_smile','They\'ve started hanging the halls. You can see it from the river when the light goes.'),
     g('idle','Church has been at it for weeks.'),
     a('guarded','It has never been up there before. Not once.'),
     g('smirk','Then they had better get the rigging right.')],
    [g('idle','Half the building is talking about the Veil.'),
     a('soft_smile','Only half?'),
     g('amused','The other half is pretending not to.')],
    [a('thoughtful','Everyone keeps saying it will be the biggest one there has ever been.'),
     g('guarded','Everyone says that every year.'),
     a('guarded','Not about the Sanctuary, they do not.'),
     g('idle','No. Not about the Sanctuary.')],
    [a('soft_smile','Will you go, do you think?'),
     g('deflect','Depends what the rota does.'),
     a('neutral','That isn\'t a no.'),
     g('smirk','It isn\'t a yes either.')],
  ],
  // Weather with some weight to it. She reads the texture, he reads the problem.
  weathered:[
    [a('neutral','The rain has turned the whole plaza orange. It\'s the lamps sitting in the water.'),
     g('idle','It\'s wet is what it is.'),
     a('soft_smile','It\'s both.')],
    [g('tired','Yard is shut again.'),
     a('neutral','Third time this month.'),
     g('smirk','I\'m going soft. You can say it.'),
     a('soft_smile','I wasn\'t going to.')],
    [a('thoughtful','In fog like this you can\'t see the Sanctuary at all. It simply isn\'t there.'),
     g('idle','It\'s there.'),
     a('soft_smile','I know. It\'s nicer thinking it comes and goes.')],
    [g('guarded','Storm is sitting right over the corridor.'),
     a('vulnerable','Is that a problem?'),
     g('smirk','It\'s a problem for the trains. Not for us.')],
    // Treatment 42, "The Chair Outside the Infirmary". Goaden reads it wrong
    // first, which the studio's aftermath mode asks for: an imperfect attempt
    // to help, and the cost surfacing through an ordinary object.
    [g('guarded','That lad\'s still sat outside the infirmary, mate.'),
     a('neutral','I know.'),
     g('idle','He was discharged Tuesday. That\'s three nights of not being where he\'s meant to be.'),
     a('thoughtful','Have you looked at the tray?'),
     g('surprised','What tray?'),
     a('vulnerable','Somebody\'s been bringing him food. It\'s still there. All of it, every night, going cold beside him.'),
     g('tired','...Ah.'),
     a('neutral','He\'s not avoiding duty, Goaden. He\'s waiting.')],
    [a('soft_smile','Somebody\'s put a second chair out.'),
     g('deflect','It was in the way.'),
     a('amused','It was in the corridor, where chairs live.'),
     g('idle','It\'s a chair. He can use it or not use it.'),
     a('neutral','He used it. Zara sat in it for an hour last night and said nothing at all, which I\'m told was perfect.')],
    [g('idle','She\'s off the critical list, yeah.'),
     a('vulnerable','He knows?'),
     g('idle','He knows. He ate the whole tray in about four minutes and then went and slept for eleven hours.'),
     a('soft_smile','Good.'),
     g('smirk','He\'s put both chairs back, mind. Very carefully. Squared them up with the wall and everything.'),
     a('amused','Of course he did.')],
  ],
});

const NOTABLE_WEATHER = new Set(['heavy_rain','fog','storm']);

// Which bank the day has earned. The three pressing moods win outright and in
// this order: a broken plan outranks the worry it caused, and worry outranks
// friction between them. They are also rare, so nothing is crowded out by them.
//
// Below that there is no single right answer, and a strict ladder was the wrong
// shape — measured over four months it handed better than half of all evenings
// to the weather, purely because notable weather is common, and left ordinary
// days almost unreachable once trust had settled high. So the baseline gathers
// every mood that fits the evening and chooses among them on a seeded hash.
export function moodFor({ concern = 0, irritation = 0, trust = 0, weatherCode = 'cloudy', repairing = false,
  veilPhase = 'distant', colour = null } = {}, seed = '', key = '') {
  if (repairing) return 'repair';
  if (concern >= 2) return 'strained';
  if (irritation >= 1) return 'friction';
  // A day the director spent on an awkward encounter has a subject the evening
  // can reach for. It sits below the three pressing moods deliberately: being
  // looked through in a corridor does not outrank a broken plan or a bad week.
  if (colour === 'sidelong') return 'sidelong';
  // The Veil joins the baseline rather than overriding it, so a close festival
  // colours the ordinary evenings instead of replacing every one of them.
  const candidates = ['ordinary'];
  if (veilPhase === 'preparing' || veilPhase === 'imminent' || veilPhase === 'underway') candidates.push('veil');
  if (NOTABLE_WEATHER.has(weatherCode)) candidates.push('weathered');
  if (trust >= 4) candidates.push('close');
  const index = createHash('sha256').update(`${seed}|mood|${key}`).digest().readUInt32BE(0) % candidates.length;
  return candidates[index];
}

// Seeded, so a given day always plays the same scene and a replay is a no-op.
// Everybody an exchange needs on screen who is not one of the pair.
// An exchange is either a bare list of lines, or a gated one that declares the
// cause it needs. Gating lives here rather than in the mood table because a
// mood is a temperature and a cause is a reason, and the audit showed that
// letting a temperature stand in for a reason is how the strongest line in the
// world ended up firing from its calmest state.
export const linesOf = exchange => (Array.isArray(exchange) ? exchange : exchange.lines);
export const requiresOf = exchange => (Array.isArray(exchange) ? null : exchange.requires ?? null);

export const guestsOf = exchange => [...new Set(linesOf(exchange).map(line => line.who))]
  .filter(who => who !== 'goaden' && who !== 'ashai');

// A colleague can only speak in a room they could actually be in.
//
// The pair's conversations declare their own participants, so a third voice
// written into the lines would put somebody on screen the world never placed
// there — the same fault the venue bank had before guests were checked against
// who was actually sent. `present` is the list of colleagues the building says
// are plausibly in this room at this hour; an exchange needing anybody else is
// not performable and is never chosen.
export function selectExchange(mood, seed, key, { present = [], causes = [] } = {}) {
  const bank = EXCHANGES[mood] ?? EXCHANGES.ordinary;
  // A gated exchange is simply not in the draw unless its cause is present.
  // Note the order: the cause filter runs first and is never relaxed, so the
  // fallback below can widen who may be in the room but can never reach a line
  // whose reason has not happened.
  const caused = bank.filter(exchange => {
    const needs = requiresOf(exchange);
    return !needs || causes.includes(needs);
  });
  const performable = caused.filter(exchange => guestsOf(exchange).every(who => present.includes(who)));
  const pool = performable.length ? performable : caused.filter(exchange => !guestsOf(exchange).length);
  const fallback = caused.length ? caused : bank.filter(exchange => !requiresOf(exchange));
  const chosen = pool.length ? pool : fallback;
  if (!chosen.length) return linesOf(bank[0]).map(line => ({ ...line }));
  const index = createHash('sha256').update(`${seed}|dialogue|${mood}|${key}`).digest().readUInt32BE(0) % chosen.length;
  return linesOf(chosen[index]).map(line => ({ ...line }));
}

// One old three-line script asserted an unrecorded waking time. It can already
// exist in saved worlds, so new selection gates alone cannot repair its public
// performance. Revise only this exact script, and only from public, earlier
// evidence that both speakers worked the night and subsequently slept late.
export function correctLegacyWakeDialogue(event, publicSources = []) {
  const expected = [
    ['goaden', "You've been up since five."],
    ['ashai', 'So have you.'],
    ['goaden', 'Yeah, but I carry it better.'],
  ];
  const lines = event?.payload?.lines ?? event?.lines;
  if (event?.visibility !== 'public' || event.type !== 'CONVERSATION'
    || !Number.isSafeInteger(event.occurredAt) || !Array.isArray(lines) || lines.length !== expected.length
    || !['goaden', 'ashai'].every(who => event.participants?.includes(who))
    || !lines.every((line, index) => line.who === expected[index][0] && line.text === expected[index][1])) return event;
  const day = londonDate(event.occurredAt);
  const availableSources = typeof publicSources === 'function' ? publicSources(event) : publicSources;
  const sources = (Array.isArray(availableSources) ? availableSources : []).filter(source => source?.visibility === 'public'
    && typeof source.id === 'string' && source.id.length > 0
    && typeof source.publicDescription === 'string' && source.publicDescription.length > 0
    && Number.isSafeInteger(source.occurredAt) && source.occurredAt < event.occurredAt
    && londonDate(source.occurredAt) === day);
  const night = sources.find(source => source.type === 'NIGHT_WORK_END'
    && londonClock(source.occurredAt).hour < 6
    && ['goaden', 'ashai'].every(who => source.participants?.includes(who)
      && sources.some(recovery => recovery.type === 'NIGHT_RECOVERED'
        && recovery.participants?.includes(who) && recovery.occurredAt > source.occurredAt
        && londonClock(recovery.occurredAt).hour >= 6 && recovery.causedBy?.includes(source.id))));
  if (!night) return event;
  const recovered = sources.filter(source => source.type === 'NIGHT_RECOVERED'
    && source.occurredAt > night.occurredAt && londonClock(source.occurredAt).hour >= 6
    && source.causedBy?.includes(night.id) && source.participants?.some(who => ['goaden', 'ashai'].includes(who)));
  const revisedLines = lines.map((line, index) => index === 0
    ? { ...line, text: "You've had a long night." } : { ...line });
  return { ...event, causedBy: [...new Set([...(event.causedBy ?? []), night.id, ...recovered.map(source => source.id)])],
    payload: { ...event.payload, lines: revisedLines }, ...(Array.isArray(event.lines) ? { lines: revisedLines } : {}) };
}

// One line of feed text for a scene the page may not be rendering in full.
export function summarise(mood) {
  return {
    repair:'Goaden and Ashai talked about the evening the callout cost them.',
    strained:'Goaden and Ashai talked about the week the city was having.',
    friction:'Goaden and Ashai had a short, pointed conversation.',
    sidelong:'Goaden and Ashai talked about the people they work with.',
    weathered:'Goaden and Ashai talked while the weather sat over the building.',
    veil:'Goaden and Ashai talked about the Veil coming to the Sanctuary.',
    close:'Goaden and Ashai talked about nothing in particular for a while.',
    ordinary:'Goaden and Ashai talked in the common room.',
  }[mood] ?? 'Goaden and Ashai talked in the common room.';
}

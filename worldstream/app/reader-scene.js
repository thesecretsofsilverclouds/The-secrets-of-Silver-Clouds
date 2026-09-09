// A reading performance of already recorded words. No dialogue, gestures or
// explanations are authored here, and none of the source event is changed.
const text = value => typeof value === 'string' ? value.trim() : '';
const silent = who => ['lintel', 'nimbus'].includes(who);
const defaultName = who => text(who).replace(/[_-]+/g, ' ')
  .split(' ').map(word => word === word.toUpperCase()
    ? word.charAt(0) + word.slice(1).toLowerCase()
    : word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const paragraphs = value => text(value).split(/\n\s*\n/).map(text).filter(Boolean)
  .map(value => ({ text: value, kind: 'prose' }));

function spokenText(value) {
  const valueText = text(value);
  // A few recorded lines already carry their enclosing speech marks. Remove
  // only that pair; quotations inside the actual line remain exactly as given.
  return (valueText.startsWith('“') && valueText.endsWith('”'))
    || (valueText.startsWith('"') && valueText.endsWith('"'))
    ? valueText.slice(1, -1) : valueText;
}

function dialogueParagraphs(source, speakerLabel) {
  const lines = (Array.isArray(source) ? source : []).filter(line => text(line?.text))
    .map(line => ({ who: text(line.who), text: silent(text(line.who)) ? text(line.text) : spokenText(line.text) }));
  // Lintels do not speak. Their authored venue beats record visible actions,
  // even though the scene player uses a speaker slot to stage those actions.
  const speakers = new Set(lines.map(line => line.who).filter(who => who && !silent(who)));
  let spokenIndex = 0, previousSpeaker = null;
  return lines.map(line => {
    if (silent(line.who)) {
      spokenIndex = 0; previousSpeaker = null;
      return { text: line.text, kind: 'prose', who: line.who };
    }
    const name = line.who ? text(speakerLabel(line.who)) || defaultName(line.who) : '';
    // Establish both voices, then let a clearly alternating pair speak. Renew
    // attribution every four lines and whenever that alternation is broken.
    // With a larger cast every line names its speaker: presence is not guessed.
    const attributed = Boolean(name) && (spokenIndex < 2 || speakers.size !== 2 || spokenIndex % 4 === 0
      || !previousSpeaker || previousSpeaker === line.who);
    spokenIndex++; previousSpeaker = line.who;
    let spoken = line.text;
    if (attributed && !/[?!…—–]$|\.{3}$/.test(spoken)) spoken = spoken.replace(/[.,;:]$/, '') + ',';
    const verb = /\?$/.test(line.text) ? 'asked' : 'said';
    return { text: `“${spoken}”${attributed ? ` ${verb} ${name}.` : ''}`, kind: 'dialogue',
      ...(line.who ? { who: line.who } : {}) };
  });
}

/** Ordered, plain-text paragraphs from one committed event or accepted scene. */
export function readingSceneParagraphs(event = {}, acceptedScene = null, speakerLabel = defaultName) {
  const label = typeof speakerLabel === 'function' ? speakerLabel : defaultName;
  if (event.type === 'SCENE_BANK_BEAT' && Array.isArray(event.narrativeParagraphs)) {
    const authored = event.narrativeParagraphs.filter(item => text(item?.text)
      && ['prose', 'dialogue'].includes(item.kind)).map(item => ({ text: item.text, kind: item.kind,
      ...(text(item.who) ? { who: item.who } : {}) }));
    if (authored.length) return authored;
  }
  if (acceptedScene && typeof acceptedScene === 'object') {
    const accepted = [
      ...paragraphs(acceptedScene.openingNarration),
      ...dialogueParagraphs((Array.isArray(acceptedScene.beats) ? acceptedScene.beats : [])
        .map(beat => ({ who: beat?.speaker, text: beat?.line })), label),
      ...paragraphs(acceptedScene.closingNarration),
    ];
    // Once an accepted scene has words, it is the complete performance. Do not
    // splice in a newer raw opening, duplicate its dialogue or add its summary.
    if (accepted.length) return accepted;
  }
  const lines = dialogueParagraphs(event.lines, label);
  const prose = text(event.readerProse ?? event.prose);
  const description = text(event.readerDescription ?? event.description ?? event.publicDescription);
  const brief = Number.isInteger(event.readerWeight) && event.readerWeight <= 1;
  // Dialogue survives missing prose/register metadata. A machine description of
  // the exchange is not an opening: without authored prose, start with speech.
  const opening = lines.length ? (brief ? '' : prose) : brief ? description : prose || description;
  return [...paragraphs(opening), ...lines];
}

/** Append the same reading text safely to a real or test DOM container. */
export function appendReadingScene(container, event, { scene = null, speakerLabel,
  className = 'event-prose' } = {}) {
  const doc = container?.ownerDocument;
  if (!doc?.createElement || typeof container.append !== 'function') return [];
  const nodes = readingSceneParagraphs(event, scene, speakerLabel).map(paragraph => {
    const node = doc.createElement('p');
    node.textContent = paragraph.text;
    node.className = [className, paragraph.kind === 'dialogue' ? 'reader-dialogue' : ''].filter(Boolean).join(' ');
    if (paragraph.who && node.dataset) node.dataset.who = paragraph.who;
    container.append(node);
    return node;
  });
  return nodes;
}

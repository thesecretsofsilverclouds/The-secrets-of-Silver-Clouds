import { createHash } from 'node:crypto';
import { relationshipChoicePresentation } from './relationship-choices.mjs';

// Read-side performance only. No new outcomes, world writes or clocks. Bounded
// dialogue performs the committed scene when the source has no authored lines.
// Existing event family supplies the subject; its outcome supplies the ending.
// Incidental posture/attention may stage that event but cannot grant an answer,
// a game win, another appointment, forgiveness, authority, or future knowledge.
// Canon priority: manuscript.pdf > canon text > site, with PHASE0-CONTINUITY's
// named Legion/Zara exceptions and the existing pre-revelation knowledge locks.
// Performance anchors in canon/manuscript_indexed.txt:
// P00163 Kai's shoulder/weight; P00520 Greah's soft glow; P00479 Yukon gaming;
// P00382 Henderson; P00495 Hammond's silence; P00669 Davis's measured warmth;
// P00728 Emily's sunny delivery; P00788-798 Legion; P01779-786 reunion gestures.
// These anchors inform cadence, not additional events or imported memories.

const TYPES = new Set(['SUPPORTING_COMMITMENT', 'SUPPORTING_ENCOUNTER',
  'SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE', 'SUPPORTING_CALLBACK']);
const OUTCOMES = new Set(['kept', 'missed', 'cut_short']);
const LEADS = Object.freeze({ goaden: 'Goaden', ashai: 'Ashai' });
const pick = (event, stage, choices) => choices[createHash('sha256')
  .update(`supporting-editorial-v2|${event.id}|${stage}`).digest().readUInt32BE(0) % choices.length];

// Saved ledgers contain both the original family labels and the concrete
// subjects now emitted by supporting-stories.mjs. These are exact equivalents;
// cast/owner/outcome guards below still decide whether a scene may be performed.
const FAMILY_ALIASES = Object.freeze({
  'one more go at the game': 'another attempt',
  'a question about the rota': 'a timing question',
  'the gap between handovers': 'a handover interval',
  'the second chair': 'a quiet seat',
  'half an hour with Kai': 'time with Kai',
  'a quiet half hour with Greah': 'time with Greah',
  'a few minutes of not competing': 'a little quiet',
  'a rhythm run past Goaden': 'a shorter rhythm',
  'an argument older than the room': 'an end to the argument',
  'an opinion on a verse': 'one short verse',
  'a few minutes without the next thing': 'a few minutes together',
  'a few minutes nearby': 'a cautious pause',
  'a break from the handover': 'an unhurried interval',
});
const familyKey = family => Object.hasOwn(FAMILY_ALIASES, family) ? FAMILY_ALIASES[family] : family;

// All family strings are already authored in supporting-stories.mjs. Unknown
// families are refused rather than interpolated into public copy.
const BANK = {
  'another attempt': {
    guest: 'yukon', name: 'Yukon', subject: 'the game attempt',
    request: n => `${n} agreed to keep Yukon company for another attempt at the game.`,
    begin: n => `${n} joined Yukon for the next attempt.`,
    end: n => `${n} stayed with Yukon through the end of the game attempt.`,
    opening: n => [
      `Yukon tightened his grey fingers around the controller. He wanted company for another attempt at the game. ${n === 'Goaden' ? 'Goaden agreed to watch. He looked rather too pleased by the prospect of seeing Yukon get angry with it.' : 'Ashai agreed to watch. Yukon looked from her to the screen, already impatient to begin.'}`,
      `Yukon still had the controller in his hands when ${n} agreed to keep him company. Another attempt. He rolled his shoulders, his pointed ears framing a face set against the screen. This time, at least, somebody would be watching.`],
    middle: n => [
      `Yukon leaned towards the screen as the attempt began, thumbs working the controller. ${n === 'Goaden' ? 'Goaden settled beside him, the start of a grin tugging at his mouth.' : 'Ashai sat forward to follow what he was doing.'}\n\nHis jaw tightened. He jerked the controller to one side, as if the thing needed showing where to go. ${n} stayed with him, watching the game.`,
      `The attempt began. Yukon held the controller low and tight, his fingers moving rapidly over it. ${n === 'Goaden' ? 'Goaden watched the screen, then glanced at the player. His grin widened.' : 'Ashai followed the screen with him. When he shifted sharply beside her, she looked down at his hands.'}\n\nYukon leaned further in. He had asked for company; he had it now.`],
    ending: n => [
      `Yukon’s hands went still. The game attempt was over. He lowered the controller and looked at ${n}.\n\n${n === 'Goaden' ? 'Goaden was still beside him, looking back with one eyebrow raised.' : 'Ashai turned from the screen and met his look.'} The company Yukon had asked for had lasted through the attempt.`,
      `At the end of the attempt, Yukon sat back and loosened his grip on the controller. ${n} had stayed beside him the whole time.\n\n${n === 'Goaden' ? 'Goaden gave him a sideways look. Yukon turned towards him, controller resting in his lap.' : 'Ashai looked from the screen to him. He had somebody to talk to now that his hands had stopped moving.'}`],
  },
  'a timing question': {
    guest: 'henderson', name: 'General Henderson', subject: 'the timing question',
    request: n => `${n} agreed to help General Henderson settle a question of timing.`,
    begin: n => `${n} and General Henderson turned to the timing question.`,
    end: n => `${n} and General Henderson settled the timing question.`,
    opening: n => [
      `Henderson needed to check the timing on a rota. ${n === 'Goaden' ? 'Goaden agreed to help, keeping his usual slouch as he gave the General his attention.' : 'Ashai agreed to help. She turned towards the General, waiting to hear which part needed checking.'}`,
      `The General had a question about the rota before he continued his rounds. ${n} agreed to go through it with him. Henderson began with the timing that needed checking.`],
    middle: n => [
      `Henderson went through the rota timing with ${n}. He stopped at the part he needed checked. ${n === 'Goaden' ? 'Goaden straightened a little, going back through the sequence with him.' : 'Ashai followed the sequence, then returned to the part Henderson had singled out.'}`,
      `The General explained the timing question on the rota. ${n === 'Goaden' ? 'Goaden listened, his head inclined towards Henderson as they worked through it.' : 'Ashai worked through it with him, checking how one part of the rota followed the next.'} They stayed with that question.`],
    ending: n => [
      `Henderson nodded once. The timing question on the rota was settled. ${n === 'Goaden' ? 'Goaden let his shoulders fall back into their usual slouch.' : 'Ashai finished going through it with him.'} The General had the answer he needed before continuing his rounds.`,
      `${n} stayed until the rota timing was clear. Henderson went over the answer, then nodded. That was the question settled; it would no longer hold up his rounds.`],
  },
  'a handover interval': {
    guest: 'davis', name: 'Agent Davis', subject: 'the pause between handovers',
    request: n => `${n} agreed to spend a few minutes with Agent Davis between handovers.`,
    begin: n => `${n} joined Agent Davis during her break between handovers.`,
    end: n => `${n} and Agent Davis shared the few minutes between handovers.`,
    opening: n => [
      `Davis had a few minutes between handovers. She turned towards ${n} and offered them with a smile. ${n === 'Goaden' ? 'He agreed, hands loose at his sides. Her gaze went briefly over his face before returning to his eyes.' : 'Ashai accepted. Davis kept her attention on her, waiting until she had the whole answer.'}`,
      `${n} agreed to spend Davis’s break with her. She drew back from the work and gave ${n === 'Goaden' ? 'him' : 'her'} a measured smile. The next handover had not started yet; there was time to sit.`],
    middle: n => [
      `Davis sat with ${n}, her back straight, hands resting together. She waited for ${n === 'Goaden' ? 'him' : 'her'} to settle before speaking. ${n === 'Goaden' ? 'Goaden leaned back and met her careful smile with a crooked one.' : 'Ashai settled opposite her and held her gaze.'}`,
      `${n === 'Goaden' ? 'Goaden lowered himself into the seat beside Davis, shoulders loose. She watched him make himself comfortable.' : 'Ashai sat down beside Davis. Davis turned towards her, giving her the attention she had just taken from the work.'} The break had begun. Neither needed to raise a voice to be heard.`],
    ending: n => [
      `Davis checked the time and straightened. ${n} had stayed for the whole break. She gave ${n === 'Goaden' ? 'him' : 'her'} a small nod before turning back towards the handover, her hands already moving to the work.`,
      `The few minutes between handovers were over. Davis turned back to the work, then glanced once more at ${n}. ${n === 'Goaden' ? 'He was still leaning back. He caught the glance and lifted his chin.' : 'Ashai caught the glance and nodded before getting ready to move.'}`],
  },
  'a quiet seat': {
    guest: 'kartel', name: 'Captain Hammond', subject: 'the quiet at Hammond’s table', recallSubject: 'the quiet at the table',
    request: n => `${n} accepted the quiet seat Captain Hammond made room for.`,
    begin: n => `${n} sat with Captain Hammond.`,
    end: n => `${n} stayed with Captain Hammond through the quiet pause.`,
    opening: n => [
      `Hammond made room at the table. ${n} accepted. The invitation had needed no voice.`,
      `There was space at Hammond's table, and ${n} agreed to take it. He had offered it without saying a word.`],
    middle: n => [
      `${n} sat opposite Hammond. The Captain lifted his face, the scar along it catching the light, then rested his hands on the table.\n\n${n === 'Goaden' ? 'Goaden leaned back. For once he left the obvious joke in his mouth.' : 'Ashai let her hands rest in her lap. She looked around, then back at the man across from her.'} Hammond said nothing.`,
      `Hammond waited until ${n} had settled before lowering his gaze. ${n === 'Goaden' ? 'Goaden shifted in the chair, found a comfortable angle and stayed there.' : 'Ashai sat with her shoulders easing, her hands still.'}\n\nThe Captain’s scarred face remained calm. He had offered a seat, and ${n} had taken it. Neither tried to fill the silence.`],
    ending: n => [
      `When ${n} stirred, Hammond looked up. They had shared the table without a word from him. ${n === 'Goaden' ? 'Goaden tilted his head in return, then moved his hands to the edge of the chair.' : 'Ashai returned his glance and straightened in her seat.'} The Captain inclined his head.`,
      `${n} had stayed through the quiet at Hammond’s table. At its end, the Captain raised his eyes and gave a slight nod. ${n === 'Goaden' ? 'Goaden answered it before he shifted forward.' : 'Ashai nodded back, her hands leaving her lap.'} No words passed between them.`],
  },
  'time with Kai': {
    guest: 'kai', name: 'Kai', owner: 'goaden', subject: 'the quiet with Kai',
    request: () => 'Goaden made time to be still with Kai.',
    begin: () => 'Goaden settled into a quiet moment with Kai close by.',
    end: () => 'Goaden and Kai had their few quiet minutes together.',
    opening: () => [
      'Kai shifted on Goaden’s shoulder, claws adjusting their grip. Goaden stopped and turned his head towards the small dragon. He had agreed to give him a few quiet minutes; he could start by standing still.',
      'Goaden stopped for Kai. The dragon was already warm against his shoulder, black and ivory scales catching the light as he moved. Goaden raised a hand close to him and waited for him to settle.'],
    middle: () => [
      'Kai yawned, showing his tiny fangs, and shifted his weight on Goaden’s shoulder. Goaden held still while the dragon settled.\n\nA slow breath warmed the side of his neck. He lowered his chin and watched Kai blink, his own shoulders dropping as he stopped trying to go anywhere.',
      'Goaden stayed still with Kai against his shoulder. The dragon folded closer, his little body warm through the cloth.\n\nGoaden turned his head carefully. Kai gave him a slow blink. He blinked back, then let his head rest where it was.'],
    ending: () => [
      'Goaden stirred when the quiet minutes were over. Kai adjusted his grip, still on his shoulder. Goaden waited for him, then straightened carefully. He had given the dragon the time he had set aside.',
      'Kai lifted his head as Goaden began to move again. Their quiet had lasted. Goaden kept one hand near the dragon until he had settled his weight, then let it fall to his side.'],
  },
  'time with Greah': {
    guest: 'greah', name: 'Greah', owner: 'ashai', subject: 'the quiet with Greah',
    request: () => 'Ashai made room for a quieter moment with Greah.',
    begin: () => 'Ashai paused with Greah close by.',
    end: () => 'Ashai and Greah had their few quiet minutes together.',
    opening: () => [
      'Greah hovered close to Ashai’s hand, her glow bright along its edge. Ashai stopped and looked down at her. She had a few minutes to give her Guardian, and she would spend them here.',
      'Ashai slowed for Greah. The little wings kept moving beside her, steadying the soft glow in the air. She turned her hand towards it and stopped, giving Greah her attention.'],
    middle: () => [
      'Greah hovered beside Ashai, her wings trembling as she held her place. Ashai watched the small movements, light falling across her fingers.\n\nShe eased her hand lower. Greah stayed close. Ashai’s face relaxed as she followed her, no longer looking past her for something else.',
      'Ashai kept still while Greah fluttered close to her hand. She turned it slowly, watching the glow shift over her skin.\n\nGreah held her place in the air. Ashai lowered her shoulders and stayed with her, following each small correction of her wings.'],
    ending: () => [
      'Ashai looked up when their quiet minutes were over. Greah was still close, her glow falling across the hand Ashai had begun to lower. She waited a moment before moving, then let the little wings keep pace beside her.',
      'The time Ashai had set aside for Greah had lasted. She straightened and began to move again, slowly enough to watch the glow shift beside her. Greah remained close as her hand fell to her side.'],
  },
  'a little quiet': {
    guest: 'rose', name: 'Rose', subject: 'the quiet with Rose', recallSubject: 'their earlier quiet',
    request: n => `${n} agreed to a few quieter minutes with Rose.`,
    begin: n => `${n} joined Rose for a little quiet.`,
    end: n => `${n} and Rose let their quiet pause last.`,
    opening: n => [
      `Rose wanted a few minutes without anyone trying to get the last word. ${n === 'Goaden' ? 'Goaden agreed, lifting his hands briefly. She watched until he lowered them.' : 'Ashai agreed with a nod. Rose moved enough to leave room beside her.'}`,
      `Rose looked towards the space beside her. ${n} agreed to sit quietly with her. ${n === 'Goaden' ? 'His mouth opened once, then shut again under her green-eyed stare.' : 'Ashai left it at that. Rose’s shoulders lowered a little.'}`],
    middle: n => [
      `${n === 'Goaden' ? 'Goaden settled beside Rose and drew breath as if to speak. Her eyes flicked towards him. He let it out through his nose instead.' : 'Ashai settled beside Rose and let her hands rest. Rose leaned back, red hair brushing her shoulder.'}\n\nThey sat without speaking. Rose’s gaze moved away from ${n === 'Goaden' ? 'him' : 'her'} and stayed there.`,
      `Rose sat with ${n}, one hand loose against her knee. ${n === 'Goaden' ? 'He shifted back and watched her for a moment before turning his head. He kept his mouth shut.' : 'Ashai looked around, then settled her gaze ahead. She did not ask Rose to explain why she wanted quiet.'}\n\nRose relaxed her fingers and stayed beside ${n === 'Goaden' ? 'him' : 'her'}.`],
    ending: n => [
      `Rose gave a small nod as their quiet ended. ${n} had stayed without filling it with talk. ${n === 'Goaden' ? 'He caught her eye and lifted his chin, keeping even that last moment to himself.' : 'Ashai returned the nod and began to straighten.'}`,
      `When ${n} stirred, Rose looked over. The few minutes she had asked for were over. She inclined her head, then let her gaze move on. ${n === 'Goaden' ? 'Goaden shifted forward, his hands on his knees.' : 'Ashai moved her hands from her lap and sat forward.'}`],
  },
  'a shorter rhythm': {
    guest: 'anarchy', name: 'Anarchy', bodyPair: true, subject: 'the short rhythm',
    request: n => `${n} agreed to listen to Anarchy’s short rhythm.`,
    begin: n => `Anarchy began the rhythm for ${n}, with Balthazar present through him.`,
    end: n => `${n} heard Anarchy’s rhythm through to its end.`,
    opening: n => [
      `Anarchy wanted ${n} to hear a short rhythm. His fingers were already moving as Goaden agreed. Balthazar shared that same body; the sharp lift of its chin checked Anarchy’s restless motion for a moment.`,
      `${n} agreed to listen to Anarchy’s rhythm. Anarchy flexed his hands, eager to start. Balthazar was present through him, two presences in one body, and Goaden kept his attention on the same face as its expression shifted.`],
    middle: n => [
      `Anarchy began the short rhythm, tapping it out with his fingers. ${n} followed the beat. Balthazar remained present through that same body; the hands kept moving even as the chin lifted and the expression changed.`,
      `The rhythm began under Anarchy’s fingers. He leaned into it, shoulders following the beat, while ${n} watched. Balthazar shared the same body. When the face grew still for a moment, it was still those hands keeping time.`],
    ending: n => [
      `Anarchy stopped on the last beat. ${n} had heard the whole short rhythm. The fingers lifted and stayed still, the shoulders settling after them. Balthazar remained present in the same body as Anarchy turned his face towards Goaden.`,
      `The short rhythm ended. ${n} was still listening when Anarchy lowered his hands. Balthazar shared the same body; it straightened, then held still as Goaden looked back at the face in front of him.`],
  },
  'an end to the argument': {
    guest: 'balthazar', name: 'Balthazar', bodyPair: true, subject: 'the argument about timing',
    request: n => `${n} agreed to stay while Balthazar brought the small argument about timing to a close.`,
    begin: n => `${n} listened as Balthazar, present through Anarchy, returned to the timing argument.`,
    end: n => `The timing argument ended with ${n} still there to hear it.`,
    opening: n => [
      `Balthazar wanted the argument about timing finished. He raised it through Anarchy’s body, its chin lifting as ${n} agreed to hear him out. The fingers stopped moving; Goaden had the full attention of the face before him.`,
      `${n} agreed to stay for the argument about timing. Anarchy and Balthazar shared the same body, and it straightened as Balthazar began to explain himself. Goaden folded his arms and waited.`],
    middle: n => [
      `Balthazar returned to the argument about timing. ${n} listened as the shared body grew still, Anarchy’s fingers curling against its palm. Balthazar’s voice came through that same mouth, slow and precise.`,
      `${n} listened to Balthazar through Anarchy’s body. The argument was about timing, and Balthazar went back over the disputed point. Goaden rubbed his jaw, keeping his eyes on the one face in front of him.`],
    ending: n => [
      `The argument about timing ended. ${n} waited, but no further point followed. Anarchy and Balthazar shared the same body; its hands loosened and dropped. Goaden unfolded his arms. He had stayed to hear it through.`,
      `Balthazar finished the argument about timing with ${n} still there. The body he shared with Anarchy eased back, fingers uncurling at its side. Goaden lowered his hand from his jaw. Nobody added another point.`],
  },
  'one short verse': {
    guest: 'gabriel', name: 'Gabriel', subject: 'the verse',
    request: n => `${n} agreed to listen to a verse whose timing Gabriel wanted an opinion on.`,
    begin: n => `Gabriel began the verse for ${n}.`,
    end: n => `${n} heard Gabriel’s verse to its end.`,
    opening: n => [
      `Gabriel wanted an opinion on the timing of a verse. ${n} agreed to listen. Gabriel straightened at once, running a hand back over his short blond hair before looking ${n === 'Goaden' ? 'him' : 'her'} in the eye.`,
      `${n} agreed to hear the verse. Gabriel nodded, then drew breath, his shoulders rising as he prepared to begin. The question was its timing; he wanted somebody to listen all the way through.`],
    middle: n => [
      `Gabriel began the verse for ${n}, one hand moving with the beat. His eyes kept returning to ${n === 'Goaden' ? 'Goaden’s' : 'Ashai’s'} face. ${n === 'Goaden' ? 'Goaden stayed where he was, head slightly tipped, letting him perform.' : 'Ashai followed the rhythm, watching his hand come down on each beat.'}`,
      `The verse began. Gabriel leaned into the words, his hand keeping time as ${n} listened. ${n === 'Goaden' ? 'Goaden’s face gave him little to go on. He caught himself looking at it again.' : 'Ashai kept her eyes on him, following the timing he had asked her to hear.'}`],
    ending: n => [
      `Gabriel reached the last word and lowered his hand. ${n} had heard the whole verse. He looked straight at ${n === 'Goaden' ? 'him' : 'her'}, lips parted, waiting for the opinion he had asked for. ${n === 'Goaden' ? 'Goaden held the look for a moment before shifting his weight.' : 'Ashai stayed with him, giving the timing another moment’s thought.'}`,
      `The verse ended with ${n} still listening. Gabriel kept his hand raised for the last beat, then let it fall to his side. He watched ${n === 'Goaden' ? 'Goaden’s' : 'Ashai’s'} face, waiting. The performance was over; ${n === 'Goaden' ? 'Goaden' : 'Ashai'} had heard every word.`],
  },
  'a few minutes together': {
    guest: 'truth', name: 'Truth', subject: 'the time with Truth', recallSubject: 'their earlier conversation',
    request: n => `${n} agreed to spend a few unhurried minutes with Truth.`,
    begin: n => `${n} joined Truth for the few minutes they had set aside.`,
    end: n => `${n} stayed with Truth through their time together.`,
    opening: n => [
      `Truth wanted a few minutes with ${n}. He leaned towards ${n === 'Goaden' ? 'him' : 'her'} as he asked, his voice carrying. ${n} agreed. Truth’s grin widened and he drew back enough to make room.`,
      `${n} agreed to stay with Truth for a few minutes. Truth beamed, turning his whole body towards ${n === 'Goaden' ? 'him' : 'her'}. ${n === 'Goaden' ? 'Goaden looked up at the grin and shook his head, smiling despite himself.' : 'Ashai met his look and settled herself to listen.'}`],
    middle: n => [
      `Truth turned fully towards ${n} as they settled together, leaning close enough that he had no need to raise his voice. He raised it anyway. ${n === 'Goaden' ? 'Goaden tipped his head back and looked at him, the corners of his mouth twitching.' : 'Ashai held his gaze and waited for a place to answer.'}`,
      `${n} sat with Truth. His hands moved as he began talking, his grin broad, his voice reaching well beyond the space between them. ${n === 'Goaden' ? 'Goaden leaned back, looking up at him.' : 'Ashai stayed facing him, her eyebrows rising as his voice rose.'}`],
    ending: n => [
      `Truth finished speaking and lowered his hands. ${n} had stayed for all the time they had set aside. ${n === 'Goaden' ? 'Goaden leaned forward again, meeting Truth’s grin with a tired shake of his head.' : 'Ashai returned his smile as she began to straighten.'} Truth held the look a moment before drawing back.`,
      `The few minutes with Truth were over. ${n} was still beside him when his last words came out, loud as the first. He grinned and let his hands fall. ${n === 'Goaden' ? 'Goaden rolled his shoulders, smiling up at him.' : 'Ashai smiled back, her hands leaving her lap.'}`],
  },
  'a bass part that is not working': {
    guest: 'damien', name: 'Damien', subject: 'the bass part',
    request: n => `${n} agreed to listen to the bass part Damien was working on.`,
    begin: n => `Damien began working through the bass part for ${n}.`,
    end: n => `${n} stayed to hear Damien’s bass part through.`,
    opening: n => [
      `Damien wanted someone to listen to a bass part that was not working. ${n} agreed. Damien gave a brief nod and returned his attention to the instrument, fingers resting against the strings.`,
      `${n} agreed to listen. Damien looked up from the bass long enough to check the answer, then moved his hand along the neck. He wanted the part heard before anybody started telling him what to do with it.`],
    middle: n => [
      `Damien worked through the bass part with ${n} listening. His hand moved along the neck, returned, and went through the passage again. He glanced towards ${n === 'Goaden' ? 'Goaden' : 'Ashai'} without taking his fingers from the strings.`,
      `${n} listened as Damien played the bass part. Damien bent over the instrument, fingers moving, then lifted his eyes towards ${n === 'Goaden' ? 'him' : 'her'}. ${n === 'Goaden' ? 'Goaden stayed where he was, his head tipped to listen.' : 'Ashai kept her attention on the playing.'}`],
    ending: n => [
      `Damien finished the bass part and rested his hand across the strings. ${n} had stayed to hear it through. He looked up, waiting, his fingers still against the instrument.`,
      `${n} was still listening when Damien stopped. The bass fell quiet under his hand. He lifted his chin towards ${n === 'Goaden' ? 'Goaden' : 'Ashai'}, who had stayed for the whole part.`],
  },
  'a cautious pause': {
    guest: 'emily', name: 'Emily', subject: 'the pause with Emily', recallSubject: 'their earlier pause',
    request: n => `${n} agreed to stay nearby while Emily looked around a little longer.`,
    begin: n => `${n} stayed near Emily as she looked around.`,
    end: n => `${n} stayed nearby until Emily’s short pause was over.`,
    opening: n => [
      `Emily wanted to look around a little longer. ${n} agreed to stay nearby. She adjusted the strap of her grey bag, smiled at ${n === 'Goaden' ? 'him' : 'her'}, and went back to looking.`,
      `${n} agreed to wait near Emily for a few minutes. She received the answer with a sunny smile, one hand resting on the strap of her bag. Her eyes moved away from ${n === 'Goaden' ? 'him' : 'her'}, following something further off.`],
    middle: n => [
      `Emily looked around while ${n} stayed nearby. She turned her head slowly, then glanced back at ${n === 'Goaden' ? 'him' : 'her'} with a bright smile. Her hand tightened briefly on the strap of the grey bag.`,
      `${n} remained nearby while Emily looked around. Emily shifted the grey bag against her side, then turned back to ${n} with the same cheerful expression.`],
    ending: n => [
      `Emily finished looking around. ${n} was still nearby. She settled the strap of her bag on her shoulder and turned towards ${n === 'Goaden' ? 'him' : 'her'}. The few minutes she had asked for were over.`,
      `The short pause ended with ${n} still near Emily. She looked back at ${n === 'Goaden' ? 'him' : 'her'} and smiled, drawing the grey bag closer against her side. ${n === 'Goaden' ? 'Goaden straightened and met her gaze.' : 'Ashai turned towards her, ready to move again.'}`],
  },
  'an unhurried interval': {
    guest: 'zara', name: 'Zara', subject: 'the pause with Zara', recallSubject: 'their earlier pause',
    request: n => `${n} agreed to spend Zara’s free few minutes with her.`,
    begin: n => `${n} joined Zara for a pause between pieces of work.`,
    end: n => `${n} and Zara had their few minutes free of work.`,
    opening: n => [
      `Zara had a gap between pieces of work and wanted company. ${n} agreed to stay with her. She checked the time as she gave ${n === 'Goaden' ? 'him' : 'her'} a brisk nod, then turned her attention back.`,
      `${n} agreed to spend Zara’s free few minutes with her. She was still looking at the time when ${n === 'Goaden' ? 'he' : 'she'} answered. Zara caught herself and looked up, her shoulders easing a little.`],
    middle: n => [
      `Zara sat down with ${n}, checked the time, then caught ${n === 'Goaden' ? 'him' : 'her'} watching her do it. ${n === 'Goaden' ? 'Goaden leaned back with a slow grin.' : 'Ashai raised an eyebrow.'} Zara looked back at ${n === 'Goaden' ? 'him' : 'her'}, her hands settling in her lap.`,
      `${n} settled beside Zara. Her gaze went to the time before she had quite finished sitting down. ${n === 'Goaden' ? 'Goaden watched her, his own shoulders loose against the seat.' : 'Ashai waited until she looked back, then met her eyes.'} Zara drew her hands together and gave ${n === 'Goaden' ? 'him' : 'her'} her attention.`],
    ending: n => [
      `Zara checked the time. The break was over, and ${n} had stayed through it. She straightened, gave ${n === 'Goaden' ? 'him' : 'her'} a quick nod and began to turn back to her work.`,
      `${n} was still with Zara when the break ended. She looked at the time once more, then sat forward, her hands moving from her lap. ${n === 'Goaden' ? 'Goaden caught her eye and nodded.' : 'Ashai returned her glance with a small nod.'} Zara was ready to get back to work.`],
  },
};

function gameLines(event, lead, stage) {
  if (familyKey(event.payload.family) !== 'another attempt'
    || Array.isArray(event.lines) && event.lines.length
    || Array.isArray(event.payload.lines) && event.payload.lines.length) return {};
  const lines = stage === 'middle' ? lead === 'goaden' ? [
    ['yukon', 'Watch this bit.'],
    ['goaden', "I'm watching, mate."],
    ['yukon', "It's bullshit."],
    ['goaden', 'Looks like a game from here.'],
    ['yukon', "You're enjoying this."],
    ['goaden', 'You asked for company. You got company.'],
  ] : [
    ['yukon', 'Watch this bit.'],
    ['ashai', "I'm watching."],
    ['yukon', 'The bloody thing never does what I want.'],
    ['ashai', "Then show me. I can't follow it if you keep swearing at the screen."],
    ['yukon', 'It helps.'],
    ['ashai', 'Fine. Swear and show me.'],
  ] : lead === 'goaden' ? [
    ['yukon', 'You stayed.'],
    ['goaden', 'You asked me to.'],
    ['yukon', 'Got a clever remark?'],
    ['goaden', 'Several. You want them in order?'],
  ] : [
    ['ashai', 'That was the bit you wanted me to see?'],
    ['yukon', 'Yeah.'],
    ['ashai', 'All right. I saw it.'],
    ['yukon', 'Got a clever remark?'],
    ['ashai', "You get enough of those. I said I'd stay, didn't I?"],
  ];
  return { lines: lines.map(([who, text]) => ({ who, text })) };
}

function sceneLines(event, entry, lead, stage) {
  if (entry.guest === 'yukon') return gameLines(event, lead, stage);
  // Quiet company, callbacks and unsupported conclusions do not need an
  // invented exchange. These openings perform the actual attended encounter.
  if (stage !== 'middle' || Array.isArray(event.lines) && event.lines.length
    || Array.isArray(event.payload.lines) && event.payload.lines.length) return {};
  const goaden = lead === 'goaden';
  const lines = {
    davis: goaden ? [
      ['davis', "I've got a few minutes."], ['goaden', 'Dangerous thing to tell me.'],
      ['davis', 'I noticed.'], ['goaden', 'And yet here I am.'],
    ] : [
      ['davis', "I've got a few minutes."], ['ashai', 'Then take them. You can look away from the work.'],
      ['davis', 'Is that an instruction?'], ['ashai', 'If that helps.'],
    ],
    anarchy: [
      ['anarchy', 'Listen to this.'], ['balthazar', 'He is listening.'],
      ['anarchy', 'I meant the rhythm.'], ['goaden', 'Then stop talking over it.'],
      ['anarchy', 'Bloody hell. Tough room.'],
    ],
    balthazar: [
      ['balthazar', 'The question is the timing.'], ['goaden', 'Yeah. That much I got.'],
      ['balthazar', 'Then permit me to finish.'], ['goaden', "That's what I'm here for."],
    ],
    gabriel: goaden ? [
      ['gabriel', "You're listening?"], ['goaden', "You'd bloody know if I wasn't."],
      ['gabriel', "It's the timing I want an opinion on."], ['goaden', 'Then get to the end.'],
    ] : [
      ['gabriel', "You're listening?"], ['ashai', 'Yes. Keep going.'],
      ['gabriel', 'All the way through.'], ['ashai', "That's what keep going means."],
    ],
    damien: goaden ? [
      ['damien', 'Listen to this part.'], ['goaden', "I'm listening."],
      ['damien', 'Usually involves less talking.'], ['goaden', 'Charming.'],
      ['damien', 'Yeah. Listen.'],
    ] : [
      ['damien', "Don't tell me it's fine just to get out of here."],
      ['ashai', "I haven't told you anything yet."], ['damien', 'Good. Hear it first.'],
      ['ashai', "That's what I'm doing."],
    ],
    truth: goaden ? [
      ['truth', "Sit! You've got a few minutes for me."], ['goaden', "I'm sitting."],
      ['truth', 'Good! Then stop looking as though you are about to leave.'],
      ['goaden', 'Hard to leave with you shouting at me, mate.'], ['truth', "This isn't shouting!"],
    ] : [
      ['truth', 'Good! A few minutes to ourselves!'],
      ['ashai', "I'm here, Truth. You don't have to shout."],
      ['truth', 'I am talking to you!'], ['ashai', 'Then you can turn the volume down.'],
    ],
    emily: goaden ? [
      ['emily', 'Are you bored?'], ['goaden', 'Getting there.'],
      ['emily', "I'm not."], ['goaden', 'Yeah. I noticed.'],
    ] : [
      ['emily', 'Are you bored?'], ['ashai', "No. I'm waiting."],
      ['emily', 'You can look as well.'], ['ashai', 'I am looking.'],
    ],
    zara: goaden ? [
      ['zara', "I haven't got long."], ['goaden', 'You said.'],
      ['zara', 'Just so you know.'], ['goaden', "I know. We're spending it counting it."],
    ] : [
      ['zara', "I haven't got long."], ['ashai', 'You told me.'],
      ['zara', 'I know.'], ['ashai', "Then we don't need to spend it saying that."],
    ],
  }[entry.guest];
  return lines ? { lines: lines.map(([who, text]) => ({ who, text })) } : {};
}

function historicalLead(event, story, entry) {
  // This is identity attribution for an already public failure, never a way to
  // place an absent actor into a scene or import today's result into yesterday.
  if (!story || story.id !== event.payload.supportingStoryId || story.family !== event.payload.family
    || story.guest !== entry.guest || !Array.isArray(story.causalEventIds)
    || !story.causalEventIds.includes(event.id) || !LEADS[story.lead]) return null;
  return story.lead;
}

function failure(event, entry, lead, outcome) {
  const pair = lead ? `${LEADS[lead]} and ${entry.name}` : null;
  if (entry.owner) {
    const n = LEADS[entry.owner];
    return outcome === 'missed' ? {
      description: `${n}'s planned quiet with ${entry.name} never began.`,
      prose: pick(event, 'missed', [
        `${n} had meant to stop for ${entry.name}. Those few quiet minutes never began.`,
        `The time ${n} had set aside for ${entry.name} passed without the planned pause. ${n} had not stopped to share it.`]),
    } : {
      description: `${n}'s quiet with ${entry.name} was cut short.`,
      prose: pick(event, 'cut_short', [
        `${n} had stopped with ${entry.name}, but the pause ended early. They did not get all the quiet time ${n} had set aside.`,
        `The quiet with ${entry.name} had begun. It was interrupted before ${n} had spent the few minutes planned.`]),
    };
  }
  const work = {
    yukon: ['The game attempt was meant to have company. That time together never began.',
      'The game attempt began with company, but their time together ended early.'],
    henderson: ['The rota timing was meant to be checked together. That discussion never began.',
      'They had started discussing the rota timing when the time together was cut short.'],
    davis: ['The break between handovers passed without the company planned for it.',
      'They had begun sharing the break between handovers. Their time together ended early.'],
    kartel: ['The planned time at the Captain’s table never began. They did not share the quiet they had set aside.',
      'They had sat together at the Captain’s table, but the quiet ended sooner than planned.'],
    rose: ['The quiet they had meant to share never began. They did not get those few minutes together.',
      'They had begun to sit quietly together. The pause was cut short before its planned end.'],
    anarchy: ['The short rhythm was meant to be heard together. That listening never began.',
      'The short rhythm had begun, but the time set aside to listen was cut short.'],
    balthazar: ['The argument about timing was meant to be heard through. That discussion never began.',
      'The argument about timing had begun. The time set aside to hear it through ended early.'],
    gabriel: ['The verse was meant to have a listener. The planned time to hear it never began.',
      'The verse had begun. The time set aside to listen was cut short before its planned end.'],
    damien: ['The bass part was meant to have a listener. The time set aside to hear it never began.',
      'The bass part had begun, but the time set aside to listen was cut short.'],
    truth: ['The few minutes they had set aside for talking passed without the conversation beginning.',
      'They had begun talking, but the few minutes set aside for each other were cut short.'],
    emily: ['The few minutes they had planned to spend nearby never began.',
      'The time spent nearby had begun, but it ended before the few minutes planned were over.'],
    zara: ['The break passed without the company that had been planned for it.',
      'They had begun spending the break together. That company was cut short before the break was through.'],
  }[entry.guest];
  return outcome === 'missed' ? {
    description: pair ? `${pair} never began ${entry.subject}.` : `The planned time with ${entry.name} did not happen.`,
    prose: work[0],
  } : {
    description: pair ? `${pair} began ${entry.subject}, but their time was cut short.` : `The time with ${entry.name} began, but ended early.`,
    prose: work[1],
  };
}

function callback(event, entry, n, outcome) {
  if (entry.owner) {
    const end = outcome === 'kept' ? 'had lasted to its end' : outcome === 'missed' ? 'had never begun' : 'had been interrupted';
    const touch = entry.owner === 'goaden'
      ? 'The dragon shifted against his shoulder. Goaden turned his head towards him and held still while he settled.'
      : 'The glow fell across her hand. Ashai turned it towards the light, watching the small wings hold their place.';
    return {
      description: `${n} recalled the earlier quiet with ${entry.name}.`,
      prose: pick(event, `callback-${outcome}`, [
        `${n} noticed ${entry.name}, and remembered the quiet that ${end}. ${touch}`,
        `${n} remembered that the quiet with ${entry.name} ${end}. ${touch}`]),
    };
  }
  const remembered = {
    henderson: ['The rota timing had been settled.', 'The planned discussion of the rota had never begun.', 'The discussion had started, but their time to check the rota was cut short.'],
    davis: ['They had spent the break together.', 'The break had passed without their planned company.', 'They had started sharing the break, but their time together was cut short.'],
    kartel: ['They had shared the table without a word from the Captain.', 'The quiet they had planned to share had never begun.', 'They had sat together, but the quiet at the table was cut short.'],
    rose: ['They had sat quietly together for the time she had asked for.', 'The quiet they had meant to share had never begun.', 'They had sat quietly together until the pause was cut short.'],
    anarchy: ['The short rhythm had been heard through to its last beat.', 'The planned listening had never begun.', 'The rhythm had begun, but the time to listen together was cut short.'],
    balthazar: ['The argument had ended with its listener still there.', 'The planned discussion had never begun.', 'The discussion had begun, but the time set aside to hear it was cut short.'],
    gabriel: ['The verse had been heard all the way through.', 'The planned time to hear the verse had never begun.', 'The verse had begun, but the time to listen was cut short.'],
    damien: ['The bass part had been heard through.', 'The planned time to hear the bass part had never begun.', 'The playing had begun, but the time to listen was cut short.'],
    truth: ['They had stayed and talked for the time they had set aside.', 'The conversation they had planned had never begun.', 'They had begun talking, but their time together was cut short.'],
    emily: ['They had stayed near each other for the few minutes she had asked for.', 'The few minutes they had planned nearby had never begun.', 'They had spent some time nearby before the pause was cut short.'],
    zara: ['They had spent her break together.', 'Her break had passed without the company they had planned.', 'They had begun sharing her break, but their time together was cut short.'],
  }[entry.guest];
  const ending = remembered ? remembered[['kept', 'missed', 'cut_short'].indexOf(outcome)]
    : outcome === 'kept' ? 'They had both been there for its ending.'
      : outcome === 'missed' ? 'It was the time they had meant to share, and never had.'
        : 'They had begun it together, and been interrupted before they were done.';
  // A callback is a new meeting about a known event. Physical responses happen
  // here; they are not presented as memories of gestures the ledger never knew.
  const response = {
    yukon: outcome === 'kept'
      ? 'He lifted his chin, already prepared for the matter to become his fault. It lent the recollection a familiar edge.'
      : 'He rubbed his palms together as the recollection surfaced. The game was easy to leave unfinished; being reminded of it was another matter.',
    henderson: 'The General listened without interrupting, then gave a brief nod.',
    davis: 'She turned to listen, hands together, and kept her attention on the account until it was finished.',
    kartel: 'The Captain raised his eyes and inclined his head. He offered no words in reply.',
    rose: 'She looked across, one eyebrow lifting, then lowered her gaze again.',
    anarchy: 'His fingers stirred as he listened. Balthazar remained present through that same body, its chin lifting briefly.',
    balthazar: 'He listened through the body he shared with Anarchy. The restless fingers stopped and its chin lifted.',
    gabriel: outcome === 'kept'
      ? 'He straightened at the mention of the verse, his fingers moving once before he let his hand drop.'
      : 'His mouth tightened. He drew himself straighter and listened to the account.',
    damien: 'He tipped his head towards the speaker and listened, his hands still until the account was finished.',
    truth: 'He leaned closer to listen, his hands opening as he began to answer.',
    emily: 'She tilted her head towards the speaker and smiled, one hand on the strap of her grey bag.',
    zara: 'Her glance went briefly to the time. She caught herself and looked back to listen.',
  }[entry.guest];
  const subject = entry.recallSubject ?? entry.subject;
  return {
    description: `${n} and ${entry.name} recalled ${subject}.`,
    prose: pick(event, `callback-${outcome}`, [
      `${subject[0].toUpperCase()}${subject.slice(1)} came up again between ${n} and ${entry.name}. ${ending} ${response}`,
      `${n} brought ${subject} up again with ${entry.name}. ${response} ${ending}`]),
  };
}

/** Render only the facts of this public source event. The optional owned story
 * may supply historical identity for an absent lead; it cannot supply outcomes.
 * Return null for unsupported/malformed input so callers keep the source copy.
 */
export function supportingEditorial(event, { story } = {}) {
  if (event?.visibility !== 'public' || !TYPES.has(event.type) || typeof event.id !== 'string'
    || !event.id || !event.payload || !Array.isArray(event.participants)
    || !Array.isArray(event.payload.cast)) return null;
  const family = familyKey(event.payload.family);
  if (!Object.hasOwn(BANK, family)) return null;
  const entry = BANK[family];
  if (!entry || typeof entry !== 'object') return null;
  const outcome = event.payload.outcome;
  const isFailure = ['SUPPORTING_ENCOUNTER', 'SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE'].includes(event.type)
    && ['missed', 'cut_short'].includes(outcome);
  const leads = [...new Set(event.participants.filter(id => Object.hasOwn(LEADS, id)))];
  if (leads.length > 1) return null;
  const present = leads[0] ?? null;
  if (isFailure) {
    if (event.type === 'SUPPORTING_ENCOUNTER' && outcome !== 'missed') return null;
    const historical = present ?? historicalLead(event, story, entry);
    if (entry.owner && historical && historical !== entry.owner) return null;
    return failure(event, entry, historical, outcome);
  }
  // Every performed scene needs actual public attendance, including the guest.
  // Anarchy/Balthazar share a body. Guardians cannot be summoned to a meeting
  // without their owner. Unknown cast members never become public prose.
  if (!present || !event.payload.cast.includes(present) || !event.payload.cast.includes(entry.guest)
    || entry.owner && present !== entry.owner
    || entry.bodyPair && (present !== 'goaden' || !event.payload.cast.includes('anarchy')
      || !event.payload.cast.includes('balthazar'))) return null;
  const n = LEADS[present];
  if (event.type === 'SUPPORTING_CALLBACK') return OUTCOMES.has(outcome) ? callback(event, entry, n, outcome) : null;
  if (event.type === 'SUPPORTING_COMMITMENT') {
    const choice = relationshipChoicePresentation(event, { lead: present, guest: entry.guest,
      leadName: n, guestName: entry.name });
    if (outcome === 'deferred') {
      if (choice && (Array.isArray(event.lines) || Array.isArray(event.payload.lines))) {
        const { lines, ...narration } = choice; return narration;
      }
      return choice;
    }
    if (outcome == null) return { description: entry.request(n),
      prose: [choice?.prose, pick(event, 'opening', entry.opening(n))].filter(Boolean).join('\n\n') };
  }
  if (event.type === 'SUPPORTING_ENCOUNTER' && outcome == null)
    return { description: entry.begin(n), prose: pick(event, 'middle', entry.middle(n)), ...sceneLines(event, entry, present, 'middle') };
  if (['SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE'].includes(event.type) && outcome === 'kept')
    return { description: entry.end(n), prose: pick(event, 'ending', entry.ending(n)), ...sceneLines(event, entry, present, 'ending') };
  return null;
}

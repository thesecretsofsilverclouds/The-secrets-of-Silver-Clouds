import { createHash } from 'node:crypto';

// Scenes at the places they actually go.
//
// The complaint this answers: the feed said "Goaden and Ashai arrived at
// Enchanted Ink", then "Goaden and Ashai spent time among the designs at
// Enchanted Ink", then they left. An hour in a moving tattoo parlour and not
// one thing happened in it. The spine was right and the story was missing.
//
// Ordinary venue scenes remain authored, seeded, plate-driven and lines-only.
// Enchanted Ink's appointment lifecycle owns its accepted booking and completed
// result separately. A randomly selected scene cannot create either of them.
//
// The canon that makes the Ink worth writing is at [M101]: tattoos in this
// world are alive. "Magical ink technology made possible when mythical
// creatures joined human society during the Celestial Shattering." Rose's
// tattoos undulate, Truth's shift and ripple, Kartel's arm glows. So a tattoo
// here can move. This does not establish sentience, powers, maintenance rules,
// a new tattoo for Ashai, or a completed prowler for Goaden.
export const VENUE_MOODS = Object.freeze(['browsing', 'the_impulse', 'cameo', 'the_regular']);

const g = (expression, text) => ({ who: 'goaden', expression, text });
const a = (expression, text) => ({ who: 'ashai', expression, text });
const x = (expression, text) => ({ who: 'gabriel', expression, text });
const r = (expression, text) => ({ who: 'rose', expression, text });
const t = (expression, text) => ({ who: 'truth', expression, text });
// Not friends of the house, and written as exactly that.
//
// Emily is eleven, is in the manuscript at [M90], and killed the man walking
// her home with his own shadow before giving her name "with sunny
// indifference" [M93]. The mistake would be writing her sinister. She is
// written *cheerful*, and the reader does the rest — which is the darkness the
// brief asked for and the only kind this world can carry before the checkpoint.
//
// Zara is the MI6 liaison by author decision, recorded in ANCHORS. She is the
// one guest here who is neither crew nor threat: she is a colleague, off duty,
// horrified to have run into work on a Saturday.
const e = (expression, text) => ({ who: 'emily', expression, text });
const z = (expression, text) => ({ who: 'zara', expression, text });
// Street fauna. Four road sprites who talk like a heist crew and never use a
// word they can do without, and the lintel, which does not talk at all — its
// lines are what it did, because that is the only thing it ever says.
const so = (expression, text) => ({ who: 'sprite_orange', expression, text });
const ss = (expression, text) => ({ who: 'sprite_shades', expression, text });
const sp = (expression, text) => ({ who: 'sprite_purple', expression, text });
const sb = (expression, text) => ({ who: 'sprite_blue', expression, text });
const l = (expression, text) => ({ who: 'lintel', expression, text });


// Who might plausibly be at each address. A guest with nothing written for the
// venue is not listed — an eligible visitor who cannot be cast just quietly
// downgrades the hour to the pair alone, and that is a worse outing than one
// where the world simply did not send anybody.
export const VENUE_GUESTS = Object.freeze({
  enchanted_ink: ['gabriel', 'rose', 'truth', 'emily'],
  cafe: ['zara', 'truth', 'gabriel'],
  big_ben_plaza: ['zara', 'emily', 'gabriel'],
});

// Who is at each address without being sent. A guest is booked and the world
// checks the booking; a road sprite is already under the counter and a lintel
// is already over the tables. They widen what can be performed here, and they
// are deliberately kept out of the guest preference below, so that an hour the
// world went to the trouble of sending Zara to is still an hour with Zara in
// it rather than one about a toaster.
export const VENUE_FAUNA = Object.freeze({
  enchanted_ink: ['sprite_orange', 'lintel'],
  cafe: ['sprite_blue', 'sprite_purple', 'sprite_shades', 'lintel'],
  big_ben_plaza: ['sprite_orange', 'sprite_shades', 'lintel'],
});

// Authored Phase 1 availability: one specifically released hour, not ordinary
// walk-in service. The website's years-long waiting list still exists
// (site/.../enchanted-ink.html:362). Only the lifecycle may publish this scene,
// after recording the accepted slot. Living ink itself is manuscript [M101].
export const INK_BOOKING_SCENE = Object.freeze({
  id: 'ink_prowler_booking', mood: 'the_impulse', cast: ['goaden', 'ashai'],
  summary: 'Goaden booked a released hour at Enchanted Ink for a moving prowler tattoo.',
  lines: [
    g('idle', 'That prowler. Look at the shoulder.'),
    a('thoughtful', 'You\'ve found something, then.'),
    g('smirk', 'And there was a released appointment.'),
    a('neutral', 'One opening, Goaden. People wait years.'),
    g('idle', 'I know. I wasn\'t turning it down, was I.'),
    a('amused', 'You\'re going to sit still for the whole hour?'),
    g('smirk', 'For this? Yeah.'),
    a('soft_smile', 'I want to look at that little lintel while you do.'),
    g('surprised', 'You getting it?'),
    a('amused', 'Looking. You should try it before committing.'),
  ],
});

export const VENUE_SCENES = Object.freeze({
  enchanted_ink: [
    {
      id: 'ink_prowler_browse',
      mood: 'the_impulse', cast: ['goaden', 'ashai'],
      summary: 'A prowler design caught Goaden\'s attention. Ashai was looking at a little lintel.',
      lines: [
        g('idle', 'Oi. That one.'),
        a('amused', 'We came in to look.'),
        g('smirk', 'I\'m looking. Look at it.'),
        a('thoughtful', 'It\'s a prowler.'),
        g('amused', 'It\'s a prowler that moves. Watch the shoulder.'),
        a('thoughtful', 'What is that one. The small one, second shelf.'),
        g('idle', 'The lintel?'),
        a('soft_smile', 'It drifts. Look at it, it actually drifts.'),
        g('smirk', 'Thought we came in to look.'),
        a('amused', 'I\'m looking. You\'re pointing.'),
      ],
    },
    {
      id: 'ink_wall_designs',
      mood: 'browsing', cast: ['goaden', 'ashai'],
      summary: 'The moving designs at Enchanted Ink kept interrupting their browsing.',
      lines: [
        a('thoughtful', 'The whole back wall moved when we came in.'),
        g('idle', 'It does that. Shop\'s showing off, mate.'),
        a('neutral', 'It\'s showing off at me specifically. That one has followed us three shelves.'),
        g('smirk', 'You\'ve got an admirer.'),
        a('guarded', 'I\'ve got a design stalking me around a shop, which isn\'t the same thing.'),
        g('amused', 'Get it then.'),
        a('soft_smile', 'Not today.'),
        g('idle', 'Tell it that. It\'s still following you.'),
      ],
    },
    {
      // Gabriel, and Gabriel cannot let a ranking go even in a tattoo parlour.
      id: 'ink_gabriel_wings',
      mood: 'cameo', cast: ['goaden', 'ashai', 'gabriel'],
      summary: 'They ran into Gabriel at the Ink, which went about as well as expected.',
      lines: [
        x('surprised', 'No. No, you don\'t get to be here as well.'),
        g('smirk', 'Afternoon.'),
        x('annoyed', 'This is my shop. I like this bloody shop.'),
        a('amused', 'It moves, Gabriel. You do not own it by standing in it.'),
        x('frown', 'It\'s spiritually my shop.'),
        g('idle', 'What are you looking at, bro?'),
        x('showing-off', 'Wings. Obviously wings. Down the whole arm.'),
        a('neutral', 'You have wings.'),
        x('humble', '...Wings that stay when the other ones are put away.'),
        g('amused', 'That\'s almost sad, bro.'),
        x('laughing', 'It\'s extremely sad. I still want it.'),
      ],
    },
    {
      id: 'ink_rose_florals',
      mood: 'the_regular', cast: ['goaden', 'ashai', 'rose'],
      summary: 'Rose was considering the floral designs at the Ink, and had opinions.',
      lines: [
        r('observation', 'Look at the flowers on that wall.'),
        a('thoughtful', 'You have flowers moving on your arm, and you\'re looking at more flowers.'),
        r('idle', 'I like flowers.'),
        g('smirk', 'Would not have guessed.'),
        r('cheeky', 'You do not have to take every thought out for a walk, Goaden.'),
        g('idle', 'Fair.'),
      ],
    },
    {
      // [M101]: Truth's tattoos shift and ripple. That is visible texture, not
      // evidence of a maintenance requirement or designs migrating off his arm.
      id: 'ink_truth_designs',
      mood: 'the_regular', cast: ['goaden', 'ashai', 'truth'],
      summary: 'Truth was considering designs at the Ink, at volume.',
      lines: [
        t('laughing', 'REEVER. Look at this one.'),
        g('idle', 'I\'m looking.'),
        t('stern', 'At the WALL. Not my arm.'),
        a('amused', 'Your arm is moving as much as the designs.'),
        t('shock', 'These are GESTURES, babe. Gestures!'),
        g('smirk', 'Very big gestures.'),
        t('stern', 'Big room.'),
        a('neutral', 'Apparently not big enough.'),
        t('laughing', 'Now you\'re getting it.'),
      ],
    },
    {
      // Emily sees the existing result in this scene; she needs no imported
      // private memory. Both protagonists' callback knowledge is checked before
      // selection. No tattoo sentience or new powers are implied.
      id: 'ink_emily_prowler', requires: 'known_completed_prowler',
      mood: 'cameo', cast: ['goaden', 'ashai', 'emily'],
      summary: 'A girl at the Ink took an interest in Goaden\'s moving prowler tattoo.',
      lines: [
        a('guarded', 'There\'s a girl in here.'),
        g('idle', 'I see her.'),
        a('neutral', 'On her own. Bare feet. In a tattoo shop.'),
        e('curious', 'Moths... I like the moths...'),
        a('soft_smile', '...They\'re very good moths.'),
        e('laughing', 'They follow you along the wall. Stand here. Stand here.'),
        a('surprised', 'They do.'),
        g('guarded', 'You in with somebody, love?'),
        e('thinking', 'Mm.'),
        e('curious', 'Your prowler... that one is on you... on you...'),
        g('idle', 'Yeah. That\'s the idea.'),
        e('thinking', 'It\'s very still now.'),
        a('thoughtful', 'It was moving a moment ago.'),
        e('laughing', 'Wait... wait...'),
        g('smirk', 'Whole room full of designs and she has picked mine.'),
        a('soft_smile', 'Let her look.'),
      ],
    },
    {
      id: 'ink_prowler_remembered', requires: 'known_completed_prowler',
      mood: 'the_regular', cast: ['goaden', 'ashai'],
      summary: 'At the Ink, their browsing turned back to the prowler Goaden already had.',
      lines: [
        g('smirk', 'Still the best one in here.'),
        a('neutral', 'You have already got that one.'),
        g('idle', 'Doesn\'t stop it being the best.'),
        a('soft_smile', 'You did see it through.'),
        g('amused', 'People are allowed to finish things.'),
        a('amused', 'Good. I\'ll remember that.'),
        g('deflect', 'Course you will.'),
      ],
    },
    {
      // The studio's drawing lamp keeps moving, and it takes a while for
      // anybody to notice it is moving to somewhere better. [P02157]: road
      // sprites are scavengers and menders of the city's small machinery.
      id: 'ink_light_inspector',
      mood: 'the_regular', cast: ['goaden', 'ashai', 'sprite_orange'],
      summary: 'A road sprite spent the hour adjusting the drawing lamp at Enchanted Ink, and was right every time.',
      lines: [
        a('thoughtful', 'The lamp\'s moved again.'),
        g('idle', 'The lamp has moved four fucking times.'),
        so('idle', 'It was wrong.'),
        g('surprised', 'It was where the artisan bloody put it, mate.'),
        so('idle', 'Yes. It was wrong.'),
        a('amused', 'Look at the shading on that wing, Goaden. You couldn\'t see the underside an hour ago.'),
        g('idle', 'That\'s not the point.'),
        so('idle', 'It is the point.'),
        g('smirk', 'Right. And the chair?'),
        so('idle', 'The chair was also wrong.'),
        a('amused', 'It\'s turned you thirty degrees towards the window.'),
        g('idle', 'Has it.'),
        a('soft_smile', 'You\'ve checked the mirror twice and you haven\'t moved it back.'),
        g('smirk', 'Light\'s good on this side. That\'s just true.'),
      ],
    },
    {
      // Treatment: a portrait of a thing that will not hold still. The lintel
      // does not speak; its plate carries what it did instead.
      id: 'ink_lintel_portrait',
      mood: 'the_regular', cast: ['goaden', 'ashai', 'lintel'],
      summary: 'A lintel drifted into the Ink while an apprentice was trying to draw it, which is the whole difficulty.',
      lines: [
        a('thoughtful', 'She\'s been drawing the same creature for three weeks.'),
        g('idle', 'How many\'s she got, then?'),
        a('amused', 'Nine. Not one of them finished.'),
        l('curious', 'It comes in over the door, drifts the length of the back wall, and stops where the ink smells strongest.'),
        g('smirk', 'It\'s moved. Course it has.'),
        a('neutral', 'It moves every time. That\'s the problem — she gets the outline nearly right and then the outline stops being true.'),
        l('content', 'It settles above the second shelf and lets a curl of itself come apart and reassemble.'),
        a('soft_smile', 'There. It has just done it again.'),
        g('idle', 'So she reckons she\'ll never finish one.'),
        a('thoughtful', 'No. She should keep the nine.'),
        g('surprised', 'The unfinished ones.'),
        a('soft_smile', 'Put them up together and they\'re the right shape of the thing. One drawing could only ever be a lie about it.'),
        g('idle', 'Tell her that, then.'),
        a('amused', 'I\'m building up to it. She\'s very determined and I\'m a stranger in her shop.'),
      ],
    },
    {
      // Treatment 20, "The Dragon Nobody Can See". [M25]: Kai is Goaden's
      // Guardian and rides his shoulder throughout. An artisan cannot see a
      // Guardian, so the commission has to be relayed — and Kai has notes.
      id: 'ink_kai_portrait',
      mood: 'the_impulse', cast: ['goaden', 'ashai'],
      summary: 'Goaden commissioned a drawing of Kai from an artisan who cannot see Kai. Kai had opinions about it.',
      lines: [
        g('idle', 'She can\'t see him.'),
        a('amused', 'No.'),
        g('idle', 'So I describe him and she draws it.'),
        a('thoughtful', 'And Kai stands on the counter correcting a woman who doesn\'t know he\'s there.'),
        g('smirk', 'That\'s the arrangement, yeah.'),
        a('amused', 'It looks like a kettle, Goaden.'),
        g('surprised', 'It doesn\'t look like a—'),
        a('soft_smile', 'It looks like a furious kettle.'),
        g('idle', '...The spines are wrong.'),
        a('amused', 'He says the spines are wrong.'),
        g('tired', 'He\'s said the spines are wrong four times and now he\'s started sighing at me.'),
        a('amused', 'Let me draw it. You talk, I\'ll draw, she copies.'),
        g('smirk', 'And when he doesn\'t like yours?'),
        a('neutral', 'Then he can hold the pencil.'),
        g('amused', 'Say that louder, he\'s right there.'),
        a('soft_smile', 'He knows I said it.'),
      ],
    },
    {
      // Treatment 21, "A Commission for Someone Else". Bittersweet, and Emily
      // is the one who says the plain thing nobody else will.
      id: 'ink_emily_commission',
      mood: 'cameo', cast: ['goaden', 'ashai', 'emily'],
      summary: 'Somebody was having a design done for a person who would never see it. Emily said so.',
      lines: [
        a('thoughtful', 'He\'s been in three times about the same piece.'),
        g('idle', 'Fussy, that.'),
        a('neutral', 'Not fussy. He keeps changing whose it is.'),
        e('curious', 'It\'s not his.'),
        g('surprised', 'Oi. Where did you come from?'),
        e('laughing', 'The door. I came from the door, obviously.'),
        a('thoughtful', 'What do you mean it\'s not his?'),
        e('thinking', 'He\'s not looking at it like it goes on him. He\'s looking at it like it goes on somebody else... somebody else. He keeps holding it out.'),
        a('vulnerable', '...She\'s right.'),
        e('curious', 'Is she coming to get it?'),
        a('vulnerable', 'No. I don\'t think she is.'),
        e('sad', 'Oh.'),
        e('thinking', 'Then he should have it big. On the arm where he can see it. Not the back.'),
        g('idle', 'That\'s — actually not bad advice.'),
        e('laughing', 'I know.'),
      ],
    },
  ],
  cafe: [
    {
      // Gabriel is one of the two characters readers ask after most, and he was
      // written into one venue out of three, so he could only ever turn up at
      // the Ink. A roster entry without a scene behind it is worse than nothing
      // — the hour silently downgrades to the pair alone — so here he is at the
      // quietest table in London, being the loudest thing at it.
      mood: 'cameo', cast: ['goaden', 'ashai', 'gabriel'],
      summary: 'Gabriel was at the Silver Spoon writing, and wanted that noticed.',
      lines: [
        x('showing-off', 'Do not talk to me, I\'m working.'),
        a('surprised', 'You called us over.'),
        x('annoyed', 'To tell you not to talk to me. Sit down.'),
        g('smirk', 'What is it?'),
        x('thinking', 'Second verse. It\'s going to be devastating.'),
        a('thoughtful', 'How much of it\'s written?'),
        x('humble', '...The second verse is going to be devastating.'),
        g('idle', 'So, none of it. Right.'),
        x('laughing', 'A DEVASTATING amount of none of it.'),
        a('amused', 'Rose has hers down to two lines.'),
        x('surprised', 'Two — how is that a verse? That\'s a bloody text message!'),
        g('smirk', 'It\'s finished, though.'),
        x('frown', 'I\'m aware it\'s finished. Everybody has been very bloody clear that it\'s finished.'),
      ],
    },
    {
      mood: 'browsing', cast: ['goaden', 'ashai'],
      summary: 'An hour at the Silver Spoon, mostly spent on nothing.',
      lines: [
        a('soft_smile', 'It\'s nice sitting somewhere that isn\'t the canteen.'),
        g('tired', 'Careful. You\'ll want a menu next.'),
        a('neutral', 'I might.'),
        g('idle', 'Standards are slipping.'),
        a('thoughtful', 'The window seat has a crack in it shaped like the river.'),
        g('smirk', 'Course it has.'),
      ],
    },
    {
      mood: 'the_impulse', cast: ['goaden', 'ashai'],
      summary: 'Goaden ordered for both of them without asking. It was a mixed success.',
      lines: [
        g('idle', 'Ordered, yeah.'),
        a('surprised', 'For me as well?'),
        g('smirk', 'You always have the same thing.'),
        a('guarded', 'I always have the same thing because you always order it.'),
        g('surprised', 'That isn\'t —'),
        a('amused', 'Think about it for a second.'),
        g('deflect', 'I\'m going to think about it later.'),
      ],
    },
    {
      // Measured: the café was running two written hours against twenty-eight
      // visits, so the same afternoon kept coming round. These two are the
      // quiet end of the register on purpose — the piano chapter is the best
      // writing in the barracks and nothing happens in it either.
      mood: 'the_regular', cast: ['goaden', 'ashai'],
      summary: 'Neither of them said much at the Silver Spoon, and it was fine.',
      lines: [
        a('tired', 'I\'m not going to be good company for about twenty minutes.'),
        g('idle', 'Alright, alright.'),
        a('thoughtful', 'You aren\'t going to ask.'),
        g('smirk', 'Twenty minutes, you said.'),
        a('soft_smile', '...Thank you.'),
        g('idle', 'Drink your tea, mate.'),
      ],
    },
    {
      mood: 'the_regular', cast: ['goaden', 'ashai'],
      summary: 'A row broke out at the next table and they watched it like a match.',
      lines: [
        g('surprised', 'He has ordered the wrong thing for her again.'),
        a('amused', 'Again?'),
        g('idle', 'Third time. I\'ve been coming here eight months and it\'s three for three.'),
        a('thoughtful', 'She has never once said.'),
        g('smirk', 'She\'s saying now.'),
        a('surprised', 'Oh, she\'s really saying now.'),
        g('amused', 'Best afternoon I\'ve had all week.'),
        a('neutral', 'That\'s quite bleak, actually.'),
        g('deflect', 'Watch the table.'),
      ],
    },
    {
      mood: 'cameo', cast: ['goaden', 'ashai', 'zara'],
      summary: 'Their MI6 liaison was at the Silver Spoon on her day off, and took it badly.',
      lines: [
        z('shocked', 'Oh, you\'re joking.'),
        a('surprised', 'Zara.'),
        z('idle', 'I get one afternoon. One. And it\'s got you two in it.'),
        g('smirk', 'We were here first.'),
        z('angry', 'You weren\'t here first, I\'ve been in this chair since twelve.'),
        a('amused', 'She has. There are two cups.'),
        z('smile', 'Do not do the observation thing at me on a Saturday.'),
        g('idle', 'Sit with us, then.'),
        z('sad', 'I can\'t. I\'ll start briefing you. I can feel it coming on.'),
        a('soft_smile', 'Two minutes.'),
        z('smiling', '...Two minutes. Then I go back to my own table and I have never met either of you.'),
      ],
    },
    {
      // The café is the quietest room this world owns and Truth is the loudest
      // thing in it. That is the entire scene.
      mood: 'cameo', cast: ['goaden', 'ashai', 'truth'],
      summary: 'Truth was at the Silver Spoon, and so was everyone else, unwillingly.',
      lines: [
        t('laughing', 'REEVER!'),
        a('surprised', 'Everyone has turned round.'),
        t('stern', 'Let them turn round.'),
        g('idle', 'Why are you in a tea shop.'),
        t('annoyed', 'Because the place by the arches has stopped doing the big scone. The BIG one.'),
        a('amused', 'You\'ve crossed London for a scone.'),
        t('shock', 'I crossed London for the PRINCIPLE of the bloody thing!'),
        g('smirk', 'And the scone.'),
        t('laughing', 'And the scone, obviously, I\'m not an idiot.'),
        a('soft_smile', 'Sit down, Truth.'),
        t('stern', 'I\'ll sit down when I\'ve got it, babe.'),
        g('idle', 'He\'s going to make them do a special.'),
        a('neutral', 'He\'s already doing it.'),
      ],
    },
    {
      // Treatment: the toaster acquires a ceremony. The joke only works if the
      // machine genuinely is better, so it is.
      id: 'cafe_sprite_toast',
      mood: 'the_regular', cast: ['goaden', 'ashai', 'sprite_blue'],
      summary: 'A road sprite has improved the cafe toaster, and then kept improving it.',
      lines: [
        g('surprised', 'What the fuck is that.'),
        a('amused', 'That\'s your toast.'),
        g('idle', 'That\'s a stage.'),
        sb('idle', 'It presents.'),
        g('idle', 'It what?'),
        sb('idle', 'Watch.'),
        a('soft_smile', 'There\'s a little rack. It turns.'),
        g('surprised', 'It\'s rung a bell at me.'),
        sb('idle', 'That is the finish.'),
        g('idle', 'Nah. I ordered food, mate, not an unveiling.'),
        a('amused', 'Eat the bloody toast. It\'s the best in the borough and you know it is.'),
        g('smirk', '...It\'s very good toast.'),
        sb('idle', 'The timer is mine.'),
        a('neutral', 'The timer stays. I\'d lose the bell.'),
        sb('idle', 'The bell stays.'),
        g('amused', 'That bell\'s going in a drawer by Thursday, mate.'),
      ],
    },
    {
      // Treatment: the doorbell auditions. Ends where the treatment ends —
      // disconnected, sulked over, and then quietly given somewhere to go.
      id: 'cafe_sprite_doorbell',
      mood: 'cameo', cast: ['goaden', 'ashai', 'sprite_purple'],
      summary: 'The cafe doorbell has been getting longer every morning, and this morning it was disconnected.',
      lines: [
        a('thoughtful', 'It\'s quiet.'),
        g('idle', 'It\'s a door. Doors are quiet.'),
        a('amused', 'Not this week. Monday it chimed. Tuesday it did eight notes. Yesterday a man stood in the doorway for twenty seconds waiting for permission to buy a sandwich.'),
        g('smirk', 'And she\'s pulled the wire.'),
        sp('idle', 'She pulled the wire.'),
        g('idle', 'Morning.'),
        sp('idle', 'It was finished. It was the finished one.'),
        a('neutral', 'It was twenty seconds long.'),
        sp('idle', 'Yes.'),
        a('soft_smile', 'People were queueing behind it in the rain.'),
        sp('idle', 'They were listening.'),
        g('amused', 'They were trapped, mate.'),
        a('thoughtful', 'What if it wasn\'t on the door.'),
        sp('idle', '...Go on.'),
        a('neutral', 'A board of your own. By the counter. Nobody has to come through it to hear it.'),
        sp('idle', 'A board.'),
        g('idle', 'And the door goes back to going ding.'),
        sp('idle', 'The door goes back to going ding.'),
      ],
    },
    {
      // Treatment: the sprite changing channels wants the appliance advert, not
      // the drama. Written so the sprite is never sinister, only uninterested.
      id: 'cafe_sprite_channel',
      mood: 'cameo', cast: ['goaden', 'ashai', 'sprite_shades'],
      summary: 'The cafe screen keeps changing channel at the worst possible moment, and Ashai has found out why.',
      lines: [
        a('guarded', 'It\'s done it again.'),
        g('idle', 'Done what?'),
        a('tired', 'Two weeks. Every single sodding time that programme reaches anything, the screen changes and I\'m watching a woman fold a dishwasher.'),
        g('smirk', 'A folding dishwasher. Nah.'),
        a('neutral', 'It folds, Goaden. It folds into a cupboard, and I have now seen it eleven fucking times, and I still don\'t know who took the ledger.'),
        g('surprised', 'There\'s a hand on the remote.'),
        ss('idle', 'Hello.'),
        a('surprised', 'It\'s been you.'),
        ss('idle', 'Yes.'),
        a('thoughtful', 'Every night.'),
        ss('idle', 'They fold it. Then they unfold it. Then a man carries it up some stairs on his own.'),
        g('amused', 'You\'re not even a bit sorry.'),
        ss('idle', 'No. Who took the ledger?'),
        a('amused', 'I don\'t know. That\'s the entire point.'),
        ss('idle', 'Then it was not going well anyway.'),
      ],
    },
    {
      // Treatment: the weather at table six. Nobody is wrong and nobody moves.
      id: 'cafe_lintel_table_six',
      mood: 'cameo', cast: ['goaden', 'ashai', 'lintel'],
      summary: 'A lintel has parked over the outdoor tables and it is raining on precisely one of them.',
      lines: [
        l('idle', 'It has stopped over the outside seating, low enough to touch, and it is raining on about a yard of pavement.'),
        g('idle', 'That\'s a yard of rain, that.'),
        a('amused', 'That\'s exactly a yard of rain. The next table is bone dry.'),
        g('smirk', 'And the mad bastard\'s still sat in it.'),
        a('neutral', 'He\'s been sat in it forty minutes. He says it\'s the best table in London.'),
        g('idle', 'He\'s soaked, mate.'),
        a('soft_smile', 'He\'s delighted. The woman at the next table wants it moved on and won\'t say so to its face.'),
        l('curious', 'It drifts eight inches west, which puts the rain over the woman.'),
        g('amused', 'Oh, that\'s beautiful.'),
        a('amused', 'She hasn\'t moved either. Neither of them will now. It\'s a matter of principle at both tables.'),
        g('idle', 'What\'s the owner do?'),
        a('thoughtful', 'Puts a canopy over one of them and lets them keep arguing. It\'s the only fix that doesn\'t involve telling the weather where to stand.'),
      ],
    },
    {
      // Treatment 5, "The Wrong Table". Two people who booked the same corner
      // booth for two different confidential conversations, and a house rule
      // that costs whoever reaches for anything.
      id: 'cafe_wrong_table',
      mood: 'cameo', cast: ['goaden', 'ashai', 'zara'],
      summary: 'Two people had booked the same corner booth for two very different conversations, and neither would leave.',
      lines: [
        z('shocked', 'Do not look at the corner.'),
        g('idle', 'I\'m already looking at the corner.'),
        z('angry', 'Goaden.'),
        a('thoughtful', 'Who is he?'),
        z('sad', 'He\'s the reason I booked the corner. And he\'s booked the corner. For a different conversation. With somebody who\'s nine minutes late and, with any luck, not coming at all.'),
        g('smirk', 'So neither of you can leave.'),
        z('angry', 'Neither of us can leave. Leaving is admitting whose meeting it was, and I\'m not doing that.'),
        a('amused', 'And you\'ve been sat there.'),
        z('sad', 'Forty minutes. We\'ve both ordered twice. I\'ve had a full roast I didn\'t want.'),
        g('amused', 'Right, sod it. I\'m getting chips.'),
        a('guarded', 'You\'re not.'),
        g('idle', 'Somebody\'s losing their temper in the next ten minutes and I ain\'t watching that on an empty stomach.'),
        a('tired', 'Nobody is losing their temper. She\'s put the sign up.'),
        z('happy', '...Has she?'),
        a('neutral', 'Behind the till. Anyone who draws anything pays for every plate in the room.'),
        z('smiling', 'Oh, that\'s brilliant. He\'s read it. Look at him reading it.'),
        g('idle', 'Well now I\'m definitely getting chips.'),
      ],
    },
    {
      // Treatment 10, "Finale Night". Nothing attacks the cafe. The entire
      // conflict is whether he will admit he has been watching it for weeks.
      id: 'cafe_finale_night',
      mood: 'the_regular', cast: ['goaden', 'ashai'],
      summary: 'The cafe screened the finale. Goaden claimed throughout not to be watching it.',
      lines: [
        a('amused', 'You said it was rubbish.'),
        g('idle', 'It\'s rubbish.'),
        a('soft_smile', 'You\'ve got a chair.'),
        g('smirk', 'I\'ve got a chair because it\'s a cafe and I\'m eating.'),
        a('neutral', 'You\'re facing the screen.'),
        g('idle', 'Nah, the screen\'s in the way of the wall.'),
        a('amused', 'Mm.'),
        g('surprised', 'Oh, you\'re JOKING. He\'s taken her to the final with him. After the boat!'),
        a('amused', 'Sorry — after the what?'),
        g('idle', '...I\'ve seen bits.'),
        a('soft_smile', 'You\'ve seen bits.'),
        g('smirk', 'In passing. Yukon has it on.'),
        a('amused', 'Yukon has been in Wales all fortnight, Goaden.'),
        g('idle', '...'),
        a('amused', 'Go on. Say it.'),
        g('amused', 'I hope she absolutely destroys him. That\'s all I\'m sayin\'.'),
      ],
    },
    {
      // Treatment 2, "The Cup That Comes Back Full". The staff invented five
      // explanations. Ashai asked. This one is quiet on purpose.
      id: 'cafe_two_teas',
      mood: 'browsing', cast: ['goaden', 'ashai'],
      summary: 'A regular has ordered two teas every morning for a fortnight, and only ever drinks one.',
      lines: [
        g('idle', 'She\'s done it again.'),
        a('thoughtful', 'Two teas.'),
        g('idle', 'Every morning this fortnight. Second one goes cold and goes back.'),
        a('neutral', 'The lad behind the counter thinks she\'s meeting somebody who can\'t be seen.'),
        g('smirk', 'And what\'s the girl on the till think?'),
        a('amused', 'A curse. She\'s very committed to the curse.'),
        g('idle', 'What d\'you reckon, then?'),
        a('thoughtful', 'I think I could ask her.'),
        g('surprised', 'You could just ask her.'),
        a('vulnerable', 'I did ask her.'),
        g('idle', '...Ah.'),
        a('vulnerable', 'Nine months. She said she\'s not ready to change the order yet. She said it exactly like that — yet.'),
        g('tired', 'Right.'),
        a('soft_smile', 'She ordered one this morning.'),
        g('idle', 'And the spare saucer?'),
        a('soft_smile', 'On the shelf behind the urn. Nobody\'s put it away and nobody\'s going to.'),
      ],
    },
    {
      // Treatment 9, "The Blackout Menu". No kitchen, a full room, and the only
      // people who can help are extremely aggrieved about a sealed gap.
      id: 'cafe_blackout',
      mood: 'cameo', cast: ['goaden', 'ashai', 'sprite_purple', 'sprite_blue'],
      summary: 'The cafe lost power with a full room, and the negotiation to get it back took longer than the repair.',
      lines: [
        a('guarded', 'Whole street\'s out.'),
        g('idle', 'Kitchen\'s dead, then.'),
        a('neutral', 'Kitchen\'s dead and there are thirty-one people in here who have already paid.'),
        sp('idle', 'We can do it.'),
        g('surprised', 'Can you.'),
        sp('idle', 'We could do it. If the gap was open.'),
        a('thoughtful', 'Which gap?'),
        sp('idle', 'She sealed it. February.'),
        sb('idle', 'It was a good gap.'),
        sp('idle', 'It was the best gap on this street.'),
        g('amused', 'So this is a negotiation.'),
        sp('idle', 'This is a negotiation.'),
        a('tired', 'Thirty-one people waiting on dinner and we\'re negotiating about a bloody hole.'),
        sp('idle', 'Yes.'),
        a('neutral', 'Fine. She reopens it with a proper cover on it, and you fix the board tonight.'),
        sp('idle', '...A cover.'),
        sb('idle', 'A cover is fine.'),
        sp('idle', 'Blue.'),
        sb('idle', 'It IS fine.'),
        g('smirk', 'Done, then.'),
        a('amused', 'And Goaden\'s doing the vegetables.'),
        g('surprised', 'I\'m doing the WHAT?'),
        a('soft_smile', 'There\'s no power. Somebody\'s peeling thirty-one dinners by hand and it isn\'t going to be me.'),
        g('idle', 'This is the worst night of my bloody life.'),
      ],
    },
    {
      // Treatment 43, "Lost Property, Armed". The jacket goes off with the kit
      // and there is genuinely something in the pocket.
      id: 'cafe_lost_jacket',
      mood: 'cameo', cast: ['goaden', 'ashai'],
      summary: 'Goaden\'s jacket went off with the equipment repair run, and there was something in the pocket.',
      lines: [
        g('guarded', 'Oi. Where\'s my jacket.'),
        a('amused', 'On the repair run with the kit. It was on the pile.'),
        g('surprised', 'It was on the CHAIR.'),
        a('neutral', 'It was on the pile, next to the chair, looking exactly like something on a pile.'),
        g('tired', 'Right, I need it back, mate.'),
        a('amused', 'It\'s a jacket, Goaden. It\'ll come back Thursday with a label on it.'),
        g('idle', 'There\'s something in the pocket.'),
        a('guarded', '...What sort of something.'),
        g('deflect', 'A note. For someone.'),
        a('tired', 'For someone.'),
        g('idle', 'For a contact. A legitimate one. Which is going to read very badly indeed in a repair depot.'),
        a('neutral', 'Right. Get your coat.'),
        g('smirk', 'That\'s the joke, is it.'),
        a('amused', 'That\'s the joke. Move.'),
      ],
    },
  ],
  big_ben_plaza: [
    {
      mood: 'cameo', cast: ['goaden', 'ashai', 'gabriel'],
      summary: 'Gabriel tried to perform in the plaza. New Big Ben had other ideas.',
      lines: [
        x('showing-off', 'Right. Nobody move. I\'m doing the new one, here, acoustically.'),
        a('neutral', 'Under the Chimes.'),
        x('impressed', 'WITH the Chimes. There\'s a difference and it\'s enormous.'),
        g('idle', 'Go on then.'),
        x('laughing', 'Right. Four, three —'),
        a('surprised', 'Oh, that\'s the hour.'),
        g('smirk', 'That\'s the hour.'),
        x('annoyed', 'I KNOW it\'s the fucking hour.'),
        a('amused', 'You have about eleven seconds until you\'re inaudible.'),
        x('frown', 'I\'m aware of the acoustics of my own bloody city.'),
        g('amused', 'You\'re being drowned out by a bell, bro.'),
        x('humble', 'By the BIGGEST bell. There\'s no shame in it.'),
        a('soft_smile', 'None at all.'),
        x('surprised', 'Do not be kind, it makes it worse.'),
      ],
    },
    {
      mood: 'browsing', cast: ['goaden', 'ashai'],
      summary: 'They stood under New Big Ben for the hour and let it ring.',
      lines: [
        a('thoughtful', 'You can feel the Chimes in the paving. Stand still.'),
        g('idle', 'I know.'),
        a('soft_smile', 'You aren\'t standing still.'),
        g('smirk', 'I\'m feeling it while walking. It\'s a skill.'),
        a('amused', 'It\'s not.'),
      ],
    },
    {
      mood: 'the_regular', cast: ['goaden', 'ashai'],
      summary: 'The plaza was full and neither of them wanted to be the one to leave.',
      lines: [
        g('tired', 'We should head back.'),
        a('neutral', 'We should.'),
        g('idle', '...'),
        a('soft_smile', 'Neither of us is moving.'),
        g('smirk', 'Nah.'),
      ],
    },
    {
      mood: 'the_impulse', cast: ['goaden', 'ashai'],
      summary: 'Goaden went up the plaza steps to settle an argument about the Chimes.',
      lines: [
        g('idle', 'It isn\'t on the hour. It has never once been on the hour.'),
        a('neutral', 'It\'s on the hour.'),
        g('smirk', 'Forty seconds past. Every time. Time it.'),
        a('thoughtful', '...'),
        a('surprised', 'Forty-one.'),
        g('amused', 'Forty-fucking-one!'),
        a('amused', 'Why do you know that.'),
        g('idle', 'Man\'s gunna know something, ain\'t he.'),
      ],
    },
    {
      mood: 'browsing', cast: ['goaden', 'ashai'],
      summary: 'The plaza crowd went quiet for a moment and neither of them knew why.',
      lines: [
        a('guarded', 'Everyone has stopped talking.'),
        g('idle', 'Yeah.'),
        a('neutral', 'All of them. At once.'),
        g('guarded', 'Give it a second.'),
        a('thoughtful', '...And they\'ve started again.'),
        g('idle', 'City does that. Don\'t go looking for it.'),
        a('vulnerable', 'You went looking for it.'),
        g('deflect', 'I looked. That\'s different to looking for it.'),
      ],
    },
    {
      mood: 'the_regular', cast: ['goaden', 'ashai', 'zara'],
      summary: 'Zara turned up in the plaza, which was not a coincidence, whatever she said.',
      lines: [
        z('happy', 'Fancy that.'),
        a('neutral', 'You looked up our handhelds.'),
        z('idle', 'I didn\'t look up your handhelds.'),
        g('smirk', 'You looked up our handhelds.'),
        z('smile', 'I noted where your handhelds were. There\'s a difference and it\'s a legal one.'),
        a('amused', 'What do you want, Zara?'),
        z('sad', 'Nothing. Genuinely nothing. It\'s my day off as well and I\'ve got sod all to do and nobody to do it with.'),
        g('idle', '...Right.'),
        z('smiling', 'Do not be kind about it, it\'s horrible.'),
        a('soft_smile', 'Stand there and be quiet, then. The Chimes are about to go.'),
      ],
    },
    {
      // The other kind of dark: not a threat, a child saying the wrong true
      // thing in a nice place and then not being there any more.
      mood: 'cameo', cast: ['goaden', 'ashai', 'emily'],
      summary: 'A girl at the plaza said something under the Chimes that neither of them liked.',
      lines: [
        e('curious', 'Open your mouth. You can hear it in your teeth... in your teeth...'),
        a('thoughtful', '...You can, actually.'),
        e('laughing', 'Everybody does it wrong the first time. Everybody.'),
        g('guarded', 'You come out here on your own a lot?'),
        e('thinking', 'When it\'s loud. Loud is easier.'),
        a('vulnerable', 'Easier than what, sweetheart?'),
        e('leans-in-sad', 'Than quiet. Quiet has got the voices in it.'),
        e('curious', 'Your friend has a very heavy shadow. Did you know... did you know that?'),
        g('surprised', '...Say that again.'),
        e('mocking', 'Bye. Bye bye.'),
        a('guarded', 'Goaden.'),
        g('idle', 'I know. Leave it.'),
      ],
    },
    {
      // Treatment: a lintel drifts past a street performer and their palm-sized
      // illusion arrives the size of a building. [P02158]: lintels absorb stray
      // currents of magic. Nothing here says they amplify on purpose, or that
      // the performer's spell was anything but small.
      id: 'plaza_lintel_rabbit',
      mood: 'cameo', cast: ['goaden', 'ashai', 'lintel'],
      summary: 'A performer in the plaza conjured a small rabbit of light and got one four storeys high.',
      lines: [
        a('surprised', 'Goaden.'),
        g('surprised', 'I see it.'),
        a('thoughtful', 'That\'s a rabbit.'),
        g('idle', 'That\'s a rabbit the size of the bank.'),
        l('bright', 'It hangs just off the performer\'s shoulder, brighter than it was a minute ago, and the light of the illusion bends towards it.'),
        a('neutral', 'There. He\'s not doing that. It\'s doing that.'),
        g('smirk', 'He\'s absolutely taking the credit, mate.'),
        a('amused', 'He\'s bowing. He has no idea why it worked and he\'s bowing.'),
        g('idle', 'What was it meant to be?'),
        a('soft_smile', 'Palm-sized. He does it every Saturday. There are children over there who will never accept the small one again.'),
        l('content', 'It drifts on towards the gardens, and four storeys of rabbit goes out like a lamp.'),
        g('amused', 'And there it goes.'),
        a('amused', 'He\'s going to have to learn what the weather was doing, or spend a year apologising on Saturdays.'),
      ],
    },
    {
      // Treatment: two sprites asleep in the sun, and a plaza organised around
      // not disturbing them. The joke is the seriousness, which is the voice
      // the band has whenever it is awake as well.
      id: 'plaza_sprites_napping',
      mood: 'cameo', cast: ['goaden', 'ashai', 'sprite_orange', 'sprite_shades'],
      summary: 'Two road sprites were asleep on the warm step, and the whole plaza had rerouted around them.',
      lines: [
        g('idle', 'Why\'s everyone walking round the step?'),
        a('soft_smile', 'Look down.'),
        g('surprised', 'Oh.'),
        a('amused', 'Two of them. Out cold, in the sun, on the warmest stone in the plaza.'),
        g('smirk', 'Somebody\'s put a cone out.'),
        a('neutral', 'Somebody\'s put a cone out and a paper cup with a coin in it, which I think is a misunderstanding of what\'s happening.'),
        so('asleep', '...s\'ours. The step.'),
        g('idle', 'Is it.'),
        so('asleep', 'We found it. Warm at eleven. Warm till three.'),
        a('thoughtful', 'You\'ve surveyed it.'),
        so('asleep', 'Course we surveyed it.'),
        ss('asleep', 'He surveyed it. I said the bench.'),
        so('asleep', 'The bench is in shade by one.'),
        ss('asleep', 'The bench has a back on it.'),
        g('amused', 'You having this argument now, or after?'),
        ss('asleep', 'After.'),
        a('soft_smile', 'Come on. Round, like everybody else.'),
      ],
    },
    {
      // Treatment 65, "The Match Nobody Applauds". [M66]: Kartel Hammond took a
      // vow of silence after the Alchemical society's fall, so the safest thing
      // this world can do with him is exactly what canon does — nothing.
      id: 'plaza_presence_chess',
      mood: 'cameo', cast: ['goaden', 'ashai'],
      summary: 'An exhibition player was bullying learners at the Presence board. Captain Hammond sat down opposite him.',
      lines: [
        a('guarded', 'That\'s the fourth one he\'s done that to.'),
        g('idle', 'He\'s calling it teaching.'),
        a('tired', 'He put a boy of about fifteen on the floor and then explained what the boy should have learned from it.'),
        g('smirk', 'Someone\'s sat down.'),
        a('surprised', 'Oh. Oh, that\'s Hammond.'),
        g('amused', 'This is going to be great.'),
        a('thoughtful', 'He hasn\'t said a word.'),
        g('idle', 'He won\'t. He hasn\'t said a word in years.'),
        a('neutral', 'The other one won\'t stop talking. He\'s narrating his own moves.'),
        g('smirk', 'Because nothing\'s happening to him and he can\'t work out why.'),
        a('thoughtful', 'It\'s the amount. Look at how little Hammond is using. He\'s spending about a tenth of it.'),
        g('idle', 'And the other bloke\'s been at full chat for six minutes.'),
        a('amused', 'He\'s blaming the board.'),
        g('amused', 'Course he is.'),
        a('soft_smile', 'Hammond\'s just resetting the pieces.'),
        g('idle', 'That\'s worse than saying something, that is.'),
        a('soft_smile', 'The boy\'s come back. He\'s watching Hammond\'s hands.'),
      ],
    },
    {
      // Treatment 66, "Umbrellas for the Wrong Weather". The rain over one
      // corner is not a preference. Somebody is keeping them there.
      id: 'plaza_umbrella_vendor',
      mood: 'cameo', cast: ['goaden', 'ashai', 'lintel'],
      summary: 'It has rained on one corner of the plaza for four days, and the umbrella stall has done extremely well out of it.',
      lines: [
        g('idle', 'Raining on the north corner again.'),
        a('thoughtful', 'Fourth day. Same forty feet, same hours.'),
        g('smirk', 'And that stall\'s doing a roaring trade.'),
        a('neutral', 'Eleven pounds an umbrella. He has sold out twice.'),
        l('idle', 'There are four of them over the corner, low, not moving the way they move.'),
        a('guarded', 'That\'s what\'s wrong with it.'),
        g('idle', 'Go on.'),
        a('thoughtful', 'They drift. That\'s the whole of what they do. Those four have held forty feet of pavement for four days and lintels do not hold anything.'),
        g('surprised', 'He\'s keeping them there?'),
        a('tired', 'There\'s a line of set charge along the guttering. Nothing that hurts them. Just enough that this corner is the best-fed forty feet in the borough and there\'s no reason to go anywhere else.'),
        g('amused', 'That\'s genuinely quite clever.'),
        a('guarded', 'It\'s extremely clever and he\'s taking it down this afternoon.'),
        l('curious', 'Within a minute of the guttering going quiet they are twenty feet higher and moving east.'),
        g('idle', 'There they go.'),
        a('soft_smile', 'And there goes eleven pounds an umbrella.'),
        g('smirk', 'He\'s keeping one.'),
        a('amused', 'He\'s keeping one. There\'s a drawing on it and I think the drawing is meant to be you.'),
        g('surprised', 'Why me? I\'ve not said a bloody word to the man!'),
        a('amused', 'You\'re stood next to the person who took his weather away, Goaden. That\'s enough for most people.'),
      ],
    },
    {
      // Emily is eleven. [M155]: "No Emily here... not here... who's Emily?
      // Leave... go." and [M158] "Ok... friend... let's play... let's play..."
      // The cadence is fragments, repetition and a trailing off, and she is
      // written cheerful — the reader supplies the rest. Nothing here states
      // what she can do or what she has done.
      id: 'plaza_emily_counting',
      mood: 'cameo', cast: ['goaden', 'ashai', 'emily'],
      summary: 'A girl at the plaza was counting something in the crowd, and would not say what.',
      lines: [
        e('curious', 'Forty-one. Forty-two.'),
        a('thoughtful', 'What are you counting?'),
        e('laughing', 'People who look up. Most don\'t... most of them don\'t. Forty-three.'),
        g('idle', 'Out of how many?'),
        e('thinking', 'Everyone. All of them, since the bell.'),
        a('surprised', 'That\'s — how long have you been here?'),
        e('curious', 'Since the bell. I said since the bell.'),
        g('smirk', 'She did say since the bell.'),
        e('laughing', 'Forty-four. That one was you.'),
        a('soft_smile', 'It was me.'),
        e('mocking', 'You look up a lot. You look up more than anybody. I\'ve watched.'),
        a('guarded', '...Have you.'),
        e('curious', 'Not in a bad way. Not in a bad way. Forty-five.'),
      ],
    },
    {
      id: 'plaza_emily_swing',
      mood: 'cameo', cast: ['goaden', 'ashai', 'emily'],
      summary: 'The girl on the swing at the plaza gardens had a question, and Ashai answered it honestly.',
      lines: [
        e('thinking', 'Does it hurt?'),
        a('surprised', 'Sorry?'),
        e('curious', 'The eye. The other one. Does it hurt.'),
        a('guarded', 'No.'),
        e('thinking', 'Did it, though.'),
        a('vulnerable', '...Yes. For a while.'),
        e('curious', 'Okay.'),
        g('guarded', 'Right, that\'s—'),
        a('neutral', 'It\'s fine, Goaden.'),
        e('laughing', 'He does that. He goes all quiet and square. When people ask you things.'),
        g('deflect', 'I do not.'),
        e('mocking', 'You do. You do, you do.'),
        a('amused', 'She\'s got you.'),
        e('curious', 'Push me?'),
        a('soft_smile', 'Go on then.'),
      ],
    },
    {
      // Treatment 71, "The Public Apology". Gabriel has to say sorry in a
      // public square and cannot do it without an audience, which is the joke
      // and also, exactly, the problem.
      id: 'plaza_gabriel_apology',
      mood: 'cameo', cast: ['goaden', 'ashai', 'gabriel'],
      summary: 'Gabriel had to apologise in the plaza, and could not do it without performing it.',
      lines: [
        x('showing-off', 'Right. I\'ve written it.'),
        a('tired', 'You\'ve written an apology.'),
        x('impressed', 'I\'ve written a STATEMENT.'),
        g('idle', 'How long is it?'),
        x('humble', '...Four minutes.'),
        a('neutral', 'Gabriel.'),
        x('frown', 'There\'s context! There\'s a whole section on context!'),
        g('smirk', 'Mate. What did you do?'),
        x('annoyed', 'I said the thing about the drummer.'),
        a('tired', 'To the drummer.'),
        x('humble', 'To the drummer, in front of the drummer\'s mum.'),
        g('amused', 'Oh, that\'s beautiful.'),
        a('neutral', 'Then say sorry. Two words, no context, and look at her when you do it.'),
        x('surprised', 'That\'s not an apology, that\'s a — that\'s barely a sentence.'),
        a('soft_smile', 'It\'s the whole apology. The four minutes are for you.'),
        x('frown', '...'),
        x('humble', 'I hate that that\'s true.'),
      ],
    },
  ],
});

// The plates each scene needs, so a scene can never ask for art the world has
// not got. Checked against the filesystem in the tests.
export const venueCastOf = scene => [...new Set(scene.lines.map(line => line.who))];

const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);
export const venueSceneId = (venue, scene) => scene.id
  ?? `${venue}_${createHash('sha256').update(JSON.stringify(scene.lines)).digest('hex').slice(0, 16)}`;

/**
 * The scene for a visit. Seeded off the day, so the same outing always plays
 * the same hour and a replay is a no-op.
 *
 * `available` is who could plausibly be in the room — the pair always, plus any
 * Legion member the world is willing to have turn up. A scene needing somebody
 * who is not available is simply not eligible, exactly as the Legion visits work.
 */
export function selectVenueScene({ venue, available = ['goaden', 'ashai'], seed = '', key = '', inkContext = {}, usage = {} }) {
  const bank = VENUE_SCENES[venue];
  if (!bank?.length) return null;
  const knownCompletedProwler = inkContext.completed === true
    && ['goaden', 'ashai'].every(who => inkContext.knownBy?.includes(who));
  const present = [...available, ...(VENUE_FAUNA[venue] ?? [])];
  const pool = bank.filter(scene => venueCastOf(scene).every(who => present.includes(who))
    && (!scene.requires || (scene.requires === 'known_completed_prowler' && knownCompletedProwler)));
  if (!pool.length) return null;
  // If the world went to the trouble of putting somebody else in the room, use
  // them. Measured before this line existed: guests were being sent on two
  // afternoons in five and reaching the page on fewer than one in seven,
  // because a scene needing nobody is always also performable and there are
  // more of those. Sending Zara and then writing an hour she is not in is the
  // world quietly discarding its own decision.
  const guests = available.filter(who => who !== 'goaden' && who !== 'ashai');
  const featuring = guests.length
    ? pool.filter(scene => venueCastOf(scene).some(who => guests.includes(who))) : [];
  const candidates = featuring.length ? featuring : pool;
  // Remember performances, not dates: a new date used to select the same script
  // while other equally truthful scenes had never reached the page. Stable IDs
  // also give the older, unnamed scripts a usable archive identity.
  const fewest = Math.min(...candidates.map(scene => usage[venueSceneId(venue, scene)] ?? 0));
  const fresh = candidates.filter(scene => (usage[venueSceneId(venue, scene)] ?? 0) === fewest);
  const scene = fresh[hash(`${seed}|${featuring.length ? 'venue-guest-scene' : 'venue'}|${key}`) % fresh.length];
  return { id: venueSceneId(venue, scene), mood: scene.mood, summary: scene.summary,
    lines: scene.lines.map(line => ({ ...line })), cast: venueCastOf(scene) };
}

/* Soul Sips for friends — authored Sanctuary bar content. No visitor data or generated canon.
 * The 17 feelings curate the existing Sanctuary's seven spirits with ten labels from
 * the Soul Sip game source. They are not a claim that this is the game's exact menu.
 * Sources: js/soul-sips-bar.js; soul_sip_data.gd and card_catalogue.gd in the
 * decision-evidence-pilot snapshot; data/sanctuary-after-hours.json. Regulars' Shelf,
 * vessel meanings and bottom messages follow the user's supplied brief.
 */
(function (root, factory) {
  'use strict';
  const content = factory();
  if (typeof module === 'object' && module.exports) module.exports = content;
  if (root) root.SoulSipContent = content;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const feeling = (id, name, color, description, title, lines, spirit) => ({id, name, color, description, title, lines, ...(spirit ? {spirit: `/images/soul-sips-mixer/spirit-${spirit}.webp`} : {})});
  const regular = (id, name, color, description, title, lines) => ({id, name, color, description, title, lines});

  const feelings = [
    feeling('nostalgia', 'Nostalgia', '#72b6ff', 'Laughter and loss in the same mouthful. Blue, bittersweet, familiar.', 'The Old Haunt', [
      'For the story you both remember differently and insist on telling anyway.',
      'Here’s to who you were, and the person who still recognises you.',
      'The old days had their faults. Your version has excellent lighting.',
      'For a place that shut years ago and somehow still keeps your table.',
      'A little blue trouble from before either of you knew better.',
      'To the song that brings an entire room back with it.'
    ], 'nostalgia'),
    feeling('joy', 'Joy', '#ffd16b', 'Warm gold. The taste of sunshine, with no explanation required.', 'An Excellent Bad Idea', [
      'For the person who can turn a miserable Tuesday into a story.',
      'To laughing so hard the sensible thing never gets said.',
      'A bright little pour for absolutely no special occasion.',
      'Here’s to the good bit. You’re allowed to stay in it a moment.',
      'For the laugh you can recognise from the other side of the bar.',
      'To a night worth remembering for reasons you can tell your mum.'
    ], 'joy'),
    feeling('love', 'Love', '#f39ecb', 'Rose-pink warmth. Sometimes the difficult word is the whole order.', 'Your Usual Seat', [
      'For the person whose coat you’d notice missing from the spare chair.',
      'To someone you would choose again, even knowing the bloody habits.',
      'Some things are easier to pour than say. Start here.',
      'A warm glass for the person you look for when something good happens.',
      'For a familiar hand finding yours under the table.',
      'To knowing how they take their tea, and making it anyway.'
    ], 'love'),
    feeling('glory', 'Glory', '#ff9d6b', 'Fiery red. A burning, overwhelming rush of glory.', 'Make an Entrance', [
      'For someone who deserves an entrance and usually holds the door.',
      'To the victory you watched them work for when nobody else was looking.',
      'A proper toast. They’ve earned a little fuss.',
      'Here’s to the moment it finally worked. Yes, you can tell it again.',
      'For the friend you’d cheer for even from the cheap seats.',
      'To doing something difficult and being allowed to look pleased.'
    ], 'glory'),
    feeling('sadness', 'Sadness', '#7a9cf5', 'Deep blue, with the taste of rain. No need to make it cheerful.', 'The Spare Chair', [
      'For the person you don’t need to pretend you’re fine around.',
      'A seat beside you, with no helpful speech attached.',
      'To getting through an evening without having to explain all of it.',
      'Some nights need company more than conversation.',
      'For the friend who brings tea and lets the silence stay.',
      'A quiet pour. Nothing here is asking you to cheer up.'
    ], 'sadness'),
    feeling('anger', 'Anger', '#ff617a', 'Crimson fire. Best handled with someone you trust beside you.', 'Say It Outside', [
      'For the person who lets you finish the rant before offering a solution.',
      'A little fire for the words you’ve been biting back.',
      'To somebody who can say “fair enough” and actually mean it.',
      'Poured firmly. We’re keeping the glasses on the table.',
      'For a proper conversation once you’ve both stopped rehearsing your replies.',
      'To being heard without having to get louder.'
    ], 'anger'),
    feeling('homecoming', 'Homecoming', '#eac18a', 'Warm gold, loyalty and love. The feeling of being expected.', 'Kept the Light On', [
      'For the person who makes arriving feel different from simply turning up.',
      'To a door you never have to wonder whether to knock on.',
      'A warm pour for the one who always asks when you’re getting in.',
      'Here’s to being missed, and finding your place still there.',
      'For the familiar voice calling from the next room.',
      'To somebody putting the kettle on before you’ve taken your shoes off.'
    ], 'homecoming'),
    feeling('courage', 'Courage', '#e65b2a', 'Blazing amber. The heat before the leap.', 'Go On, Then', [
      'For the person who stood beside you before either of you had a plan.',
      'To making the call with your thumb hovering over the button.',
      'A steadying pour for the thing you’ve been putting off saying.',
      'Here’s to going anyway, preferably with someone who knows the way back.',
      'For a brave face, and the friend who can see through it.',
      'To asking for a hand before you’ve dropped everything.'
    ]),
    feeling('serenity', 'Serenity', '#71cbbb', 'Pale teal. Still water and a deep breath.', 'No Rush', [
      'For the person who makes doing nothing feel like a good use of the evening.',
      'To sitting down and finding you don’t need to earn the rest.',
      'A slow pour. The washing-up can survive another ten minutes.',
      'For company that doesn’t turn every silence into a problem.',
      'Here’s to an evening with no one checking the time.',
      'For the friend who lets your shoulders come down.'
    ]),
    feeling('passion', 'Passion', '#d9446e', 'Burning crimson. Plenty of feeling; very little caution.', 'One More Song', [
      'For the person who can still talk you into staying for one more song.',
      'To wanting something enough to risk looking a little ridiculous.',
      'A warm pour for an idea that keeps you awake for the right reasons.',
      'For the friend who remembers what you sound like when you’re excited.',
      'Here’s to caring too much to give a short answer.',
      'For a night that keeps finding reasons not to end.'
    ]),
    feeling('melancholy', 'Melancholy', '#8b78c4', 'Deep violet. An old ache that still knows the tune.', 'Last Song Home', [
      'For the good memory that catches you at an inconvenient moment.',
      'To the person who understands why you’ve gone quiet at this particular song.',
      'A slow glass for an old ache you don’t want laughed out of.',
      'For the version of you who needed somebody to stay a little longer.',
      'Here’s to the names you still nearly say out loud.',
      'To remembering the good bit without pretending it was all good.'
    ]),
    feeling('mischief', 'Mischief', '#b2dd60', 'Bright, sharp and already trying to look innocent.', 'Absolutely Your Idea', [
      'For the person you should never be seated beside at anything formal.',
      'To terrible ideas with excellent company.',
      'A suspiciously innocent pour. We’ve heard that tone before.',
      'For the friend who starts laughing before you’ve finished explaining.',
      'Here’s to “hear me out”, and the poor soul who actually does.',
      'To the one who says “don’t” while already getting their coat.'
    ]),
    feeling('curiosity', 'Curiosity', '#c698ed', 'The pull of the unknown. You were only meant to have a quick look.', 'What’s Down There?', [
      'For the person who follows you down the interesting-looking street.',
      'To a quick look that somehow took the entire afternoon.',
      'A little pour for the question that started another six questions.',
      'For the friend who asks what happened next and stays for the answer.',
      'Here’s to opening the book because the title sounded odd.',
      'To finding a place you’ll struggle to explain directions to.'
    ]),
    feeling('loneliness', 'Loneliness', '#9ca2d7', 'A blue-violet quiet. Leave room for someone beside it.', 'Someone Saved a Seat', [
      'For the person you’d like beside you, even if you’ve forgotten how to ask.',
      'A glass left within reach. You can take your time coming over.',
      'To the message you nearly sent. It can still be sent.',
      'For a familiar face when the room feels much too full.',
      'Here’s to being invited without having to make yourself useful first.',
      'For the one who notices when you’ve been quiet for a while.'
    ]),
    feeling('envy', 'Envy', '#91bd73', 'A green sideways glance. Best admitted before it gets comfortable.', 'Good for You, Honestly', [
      'For the friend you’re proud of, while privately wishing it was your turn.',
      'To being honest about the awkward bit and kind about the good bit.',
      'A green pour for feelings with very poor table manners.',
      'For someone you can admit a petty thought to without becoming that thought.',
      'Here’s to cheering for them, even when it catches in your throat.',
      'To saying “I wish I had that” without taking anything away from them.'
    ]),
    feeling('fear', 'Fear', '#bfa277', 'Raw and amber-dark. A small hand around the glass helps.', 'Stay on the Line', [
      'For the person who stays on the phone until you’re through the door.',
      'To being frightened and having company for it.',
      'A steady glass for a sentence that starts with “this might sound stupid”.',
      'For the friend who checks the noise with you instead of laughing.',
      'Here’s to admitting you’d rather not do this bit alone.',
      'To somebody answering “I’m here” before you’ve finished asking.'
    ]),
    feeling('despair', 'Despair', '#736e9b', 'A heavy violet pour. Offer company; make no grand promises.', 'Sit With Me', [
      'For an evening that needs a chair beside yours and very few words.',
      'A glass for the friend who can hear “I can’t” without turning it into advice.',
      'To staying for a while, with nothing clever to say.',
      'For the person who keeps making room, even when you bring very little.',
      'A quiet invitation. No brave face required at this table.',
      'To being allowed a difficult night without having to make it a lesson.'
    ])
  ];

  const regulars = [
    regular('inside-joke', 'Inside Joke', '#dbb8ff', 'Nobody else needs to understand why that was funny.', 'You Had to Be There', [
      'For a joke with no useful explanation and an excellent survival rate.',
      'To the phrase that can still ruin both your attempts to look serious.',
      'A private little laugh in a room full of people.',
      'For the person who can make you laugh with one badly timed eyebrow.',
      'Here’s to finding it funny again. Yes, after all these years.',
      'To a perfectly ordinary word you can no longer say in public.'
    ]),
    regular('three-am-call', 'Three A.M. Call', '#8595e9', 'The number you ring when the sensible world has gone to bed.', 'You Still Up?', [
      'For the person whose first question at three in the morning is where you are.',
      'To a phone lighting up and somebody actually answering.',
      'A late pour for a friend who’ll regret being this kind in the morning.',
      'For “tell me the whole thing” when you were expecting “make it quick”.',
      'Here’s to the conversation that kept going after the crisis had passed.',
      'To the number you know without looking, even now.'
    ]),
    regular('knows-too-much', 'Knows Too Much', '#aa87c6', 'A friendship with an alarming amount of supporting evidence.', 'Witness Protection', [
      'For somebody who knows the full story and still sits beside you.',
      'To discretion, mostly. Let’s not test the mostly.',
      'A careful pour for the keeper of your least dignified memories.',
      'For the person who can say “remember when” and stop your heart briefly.',
      'Here’s to an excellent friend and a catastrophic witness.',
      'To all the evidence remaining safely between you.'
    ]),
    regular('owes-me-money', 'Owes Me Money', '#d4b271', 'An outstanding balance. Somehow still welcome at the table.', 'Put It on the Tab', [
      'For the person who owes you a tenner and somehow still gets the next drink.',
      'To old debts, flexible accounting and excellent company.',
      'A generous pour. We’ll discuss repayment at some entirely fictional date.',
      'For a friendship running on affection and very poor bookkeeping.',
      'Here’s to the money you’ll never see again and the stories you got instead.',
      'To a debt neither of you is quite ready to settle.'
    ]),
    regular('same-argument-again', 'Same Argument Again', '#f18c8f', 'You both know the lines. Nobody has won yet.', 'We’ve Been Here Before', [
      'For the argument that could now perform itself without either of you.',
      'To taking a sip before launching into the second familiar paragraph.',
      'A layered pour. Neither position appears willing to mix.',
      'For somebody worth disagreeing with properly.',
      'Here’s to hearing the bit you usually interrupt.',
      'To a conversation that might go somewhere new if you let it.'
    ]),
    regular('saved-me-slightly', 'Saved Me Slightly', '#a2cfba', 'Nothing dramatic. They arrived at just the right moment.', 'Good Timing, That', [
      'For the small favour that turned out to be quite a large thing.',
      'To the friend who didn’t know how badly you needed that laugh.',
      'A little thank-you for arriving before the evening got worse.',
      'For somebody who brought you food instead of asking whether you’d eaten.',
      'Here’s to the lift, the spare key, the call at the right time.',
      'To being helped without having to turn it into a speech.'
    ]),
    regular('still-here', 'Still Here', '#e6bb8c', 'After everything, they’re still taking the seat beside you.', 'The One Who Stayed', [
      'For the person who kept showing up once the novelty had worn off.',
      'To another evening, at the same table, with somebody worth the journey.',
      'A slow pour for a friendship that has stopped needing attendance checks.',
      'For the one who remembers the difficult years without keeping score.',
      'Here’s to still having things to tell each other.',
      'To the familiar coat on the chair and the relief of seeing it.'
    ]),
    regular('should-have-called', 'Should Have Called', '#a2afe2', 'A message left too long. The phone still works.', 'Been Meaning To', [
      'For the person you keep meaning to ring when life gets quieter.',
      'To not waiting for a better explanation than “I wanted to hear you”.',
      'A late pour. An invitation doesn’t need to arrive perfectly on time.',
      'For the name you stop at while scrolling through your contacts.',
      'Here’s to picking up where you can, instead of where you should have.',
      'To sending something warmer than another apology for being busy.'
    ]),
    regular('knew-you-before', 'Knew You Before', '#c5a1d8', 'Before the title, the confidence and the good haircut.', 'Before the Good Haircut', [
      'For the person who knew you before you learnt to explain yourself so well.',
      'To somebody who remembers the terrible haircut and never needed the new title.',
      'A familiar pour for the friend you don’t have to introduce yourself to again.',
      'For the one who can still hear your old laugh under all that confidence.',
      'Here’s to growing up without entirely losing track of each other.',
      'To being recognised in a life that looks rather different now.'
    ]),
    regular('comfortable-silence', 'Comfortable Silence', '#85bfc9', 'Two people. One table. Nobody performing.', 'Nothing to Add', [
      'For the person you can sit beside without supplying a running commentary.',
      'To an evening that doesn’t need entertaining.',
      'A quiet pour for two people who have run out of things to prove.',
      'For somebody whose company survives putting your phone away.',
      'Here’s to looking out of the same window for a while.',
      'To no awkward silence, just a perfectly decent silence.'
    ]),
    regular('growing-apart', 'Growing Apart', '#b3a2bd', 'Different routes. A small wish to meet somewhere along them.', 'Different Last Trains', [
      'For someone you miss without quite knowing when the distance started.',
      'To making room for who you both became.',
      'A careful pour for a friendship learning a different shape.',
      'For a catch-up that deserves longer than the walk to the station.',
      'Here’s to asking what their life is like now and listening properly.',
      'To the person you still want good things for, from wherever you are.'
    ]),
    regular('would-help-you-move', 'Would Help You Move', '#bcbd83', 'Actual friendship. Stairs, cardboard boxes and all.', 'Third Floor, No Lift', [
      'For the friend who asks what time, instead of how much furniture.',
      'To carrying the awkward end without mentioning it all afternoon.',
      'A proper pour for somebody who knows how heavy your books are.',
      'For the person who turns up with a van and stays for the difficult bit.',
      'Here’s to tea in the new place, drunk out of the only mugs you can find.',
      'To the friend who’ll complain about your sofa while helping you carry it.'
    ]),
    regular('proud-quietly', 'Proud Quietly', '#e2c98b', 'You noticed. You might even manage to say it.', 'Saw What You Did', [
      'For somebody you’ve been cheering for rather too quietly.',
      'To the thing they did that you noticed and haven’t mentioned enough.',
      'A small fuss for a person who’ll insist it wasn’t anything.',
      'For the friend whose good news you told somebody else immediately.',
      'Here’s to letting them hear what you say about them when they’re not there.',
      'To being pleased for them without making them give a speech.'
    ]),
    regular('started-as-rivals', 'Started As Rivals', '#b593df', 'An annoyingly good opponent. An even better friend.', 'Grudgingly Yours', [
      'For the person you were absolutely determined not to like.',
      'To a former opponent with the nerve to become excellent company.',
      'A respectful pour. You can argue about who earned it later.',
      'For somebody who makes you better and occasionally makes you furious.',
      'Here’s to admitting the other side had at least one good person.',
      'To a friendship neither of you will admit you started.'
    ]),
    regular('never-said-thanks', 'Never Said Thanks', '#c2d6ab', 'They might have forgotten the favour. You haven’t.', 'This One’s Overdue', [
      'For the thing they did ages ago that you still remember clearly.',
      'To a thank-you that took the scenic route.',
      'A warm pour for a kindness you only understood properly afterwards.',
      'For somebody who lent a hand and didn’t leave an invoice behind.',
      'Here’s to saying it while you’ve both got the time.',
      'To an old favour, finally getting its drink.'
    ]),
    regular('laughing-when-we-shouldnt', 'Laughing When We Shouldn’t', '#f2b5c8', 'Do not look at each other. That’s how it starts.', 'Don’t Look at Me', [
      'For the person you must never make eye contact with in a serious meeting.',
      'To an appalling lack of composure and a very good friend.',
      'A careful pour. You’ve already got the giggles.',
      'For the laugh you tried to swallow and somehow made much worse.',
      'Here’s to pretending you’re coughing until the moment has passed.',
      'To the one who says “stop it” without making any effort to stop.'
    ]),
    regular('one-brain-cell', 'One Brain Cell', '#e9bf7d', 'A bright golden muddle. You both thought the other one had it.', 'Shared Custody', [
      'For the person you share a brain cell with, on a timetable neither of you understands.',
      'Two people, one plan, nobody in charge of thinking it through.',
      'To giving the brain cell an evening off. It worked hard last Thursday.'
    ]),
    regular('the-group-chat', 'The Group Chat', '#a5b9ed', 'A fizzy blue pour. Six opinions, eighty messages, still no agreed time.', 'The Minutes Are Missing', [
      'For the people who can turn choosing a restaurant into a constitutional crisis.',
      'To checking your phone and finding forty messages about absolutely nothing.',
      'A round for the chat that knows too much and organises very little.'
    ]),
    regular('emotional-support-idiot', 'Emotional Support Idiot', '#ddabc7', 'Rose-gold warmth. Unqualified advice, excellent attendance.', 'Qualified in Showing Up', [
      'For the idiot who made you laugh when you were determined not to.',
      'To somebody who has no idea what they’re doing and keeps turning up anyway.',
      'A proper thank-you for the friend who makes a terrible day bearable without fixing a thing.'
    ]),
    regular('bad-influence', 'Bad Influence', '#b69ce1', 'A violet grin. Your sensible evening has already put its coat on.', 'No Adult Supervision', [
      'For the person who hears “I shouldn’t” and starts looking up the opening times.',
      'To your favourite excuse for being out later than planned.',
      'A suspiciously persuasive pour. You were going home ten minutes ago.'
    ]),
    regular('left-on-read', 'Left on Read', '#87bbc7', 'A teal pause. The reply is apparently still being aged.', 'Seen at 14:07', [
      'For the person whose reply arrives with the confidence of somebody who hasn’t left it three weeks.',
      'To a friendship with remarkably flexible response times.',
      'A little drink to accompany the message you answered in your head and nowhere else.'
    ]),
    regular('the-voice-note', 'The Voice Note', '#cfa5e2', 'A lilac pour that was meant to be brief. There’s a second part.', 'Part One of Six', [
      'For the person who says “quick one” and sends you an entire listening commitment.',
      'To a voice note with a beginning, three diversions and no discernible end.',
      'A long pour for a friend whose breathing pauses are the only chance you get to reply.'
    ]),
    regular('your-round', 'Your Round', '#dec585', 'Warm amber. An ancient disagreement, clearly documented by neither party.', 'A Developing Debt', [
      'For the person who always remembers whose round it is, unless it’s theirs.',
      'To an accounting system based entirely on looking meaningfully at your mate.',
      'A generous pour. Your contribution has been noted by the unofficial committee.'
    ]),
    regular('no-context', 'No Context', '#a9c795', 'Pale green nonsense. It means something to precisely two people.', 'It Makes Sense to Us', [
      'For the person you can send a picture of a traffic cone to and receive a sincere response.',
      'To a conversation that would alarm anybody reading it from the middle.',
      'A completely ordinary drink, if you happen to know about the spoon.'
    ]),
    regular('same-bad-decision', 'Same Bad Decision', '#e9a38e', 'Coral-bright repetition. Calling it a tradition has helped.', 'An Established Tradition', [
      'For a mistake you’ve repeated often enough to know where to meet beforehand.',
      'To doing it again, with the benefit of absolutely no lessons learnt.',
      'A familiar pour for the person who remembers how this ended and has brought their coat anyway.'
    ]),
    regular('designated-adult', 'Designated Adult', '#9dc3ba', 'Steady teal. Somebody remembered the tickets and the way home.', 'Somebody Booked the Taxi', [
      'For the friend who knows where your coat is and has started answering questions on your behalf.',
      'To the person carrying the tickets, the charger and the increasingly thin illusion of control.',
      'A well-earned glass for somebody who would like to be the irresponsible one for a change.'
    ]),
    regular('borrowed-hoodie', 'Borrowed Hoodie', '#c9afc8', 'Soft mauve, very familiar. Ownership remains under discussion.', 'On Permanent Loan', [
      'For the person whose clothes have become part of your emotional support infrastructure.',
      'To a small loan that appears to have become a change of address.',
      'A warm pour for the friend who knows you’re keeping the hoodie and still asks for it back.'
    ]),
    regular('still-on-mute', 'Still on Mute', '#a4b0d3', 'A blue-grey silence. You looked very convincing, though.', 'We Could See the Effort', [
      'For the person who gave their finest speech to a microphone that wasn’t listening.',
      'To nodding supportively while nobody can hear a bloody word.',
      'A small glass for an excellent point that may never be made quite so well again.'
    ]),
    regular('walk-you-home', 'Walk You Home', '#d8c29a', 'Warm gold. Their stop was back there; they haven’t mentioned it.', 'The Long Way Round', [
      'For the person whose “same way as you” is a generous interpretation of the map.',
      'To the friend who misses a perfectly good bus because you’re still talking.',
      'A slow pour for somebody who sees you to the door and waits for the light.'
    ]),
    regular('knows-my-order', 'Knows My Order', '#a9d2c5', 'A pale green comfort. They’ve already asked for yours.', 'Didn’t Have to Ask', [
      'For the person who returns from the bar with exactly what you wanted.',
      'To being remembered in the ordinary, lovely details.',
      'A familiar pour for somebody who notices what you leave off, as well as what you choose.'
    ]),
    regular('emergency-contact', 'Emergency Contact', '#d4a5b4', 'A rose-dark promise of company. The first number that comes to mind.', 'First on the List', [
      'For the person you put down before wondering whether you ought to ask.',
      'To the friend whose “what do you need?” comes before “what happened?”.',
      'A steady glass for the one you trust with the whole version.'
    ]),
    regular('brought-snacks', 'Brought Snacks', '#e9cb90', 'Buttery gold. Practical affection, wrapped in foil.', 'Prepared for Anything', [
      'For the friend who correctly identified that the emotional situation needed a sandwich.',
      'To arriving with snacks when everybody else brought a theory.',
      'A generous pour for the person who packed an extra one because they know you.'
    ]),
    regular('for-legal-reasons', 'For Legal Reasons', '#a999c9', 'Purple evasiveness. A very interesting hypothetical, apparently.', 'Entirely Hypothetical', [
      'For the story that becomes “a friend of mine” whenever somebody new joins the table.',
      'To an entirely hypothetical evening involving people who looked remarkably like you.',
      'A discreet pour. We’ll agree the karaoke machine started it.'
    ]),
    regular('found-you-anyway', 'Found You Anyway', '#d7b7dc', 'A soft violet recognition. Different crowd, same familiar face.', 'There You Are', [
      'For the person you look for when you’ve lost track of what kind of evening you’re having.',
      'To finding your friend in a crowded room and suddenly having somewhere to stand.',
      'A small, warm pour for the face that makes you stop pretending you’re having fun.'
    ])
  ];

  const glasses = [
    {id:'crystal-shot', name:'Crystal Shot', description:'Quick, sharp, immediate hit.', meaning:'Straight talk. Say it before you lose your nerve.', line:'A small glass for getting to the point.'},
    {id:'misted-glass', name:'Misted Glass', description:'Slow release with a lingering aftertaste.', meaning:'Old flames, old feelings and things that linger.', line:'Take your time. This one leaves something behind.'},
    {id:'glowing-vial', name:'Glowing Vial', description:'Concentrated essence, intense but brief.', meaning:'A short, bright friendship. An unforgettable little interval.', line:'A small, bright thing, worth having while it lasts.'},
    {id:'bone-glass', name:'Bone Glass', description:'Etched ivory cup; carries weight and ceremony.', meaning:'Family, chosen or otherwise. A little ceremony for the complicated ones.', line:'A little ceremony for somebody who matters.'},
    {id:'celestial-tankard', name:'Celestial Tankard', description:'Heavy stein, tall pour for slow patrons.', meaning:'A long friendship. Neither of you is in a hurry.', line:'Poured slowly. There’s time for the long version.'},
    {id:'duskkin-tankard', name:'Duskkin Tankard', description:'Soot-black mug; hides what’s coming.', meaning:'It’s complicated. Let the layers speak for themselves.', line:'The glass is keeping its opinion to itself.'}
  ];
  const seasonings = [
    {id:'clarity', name:'Clarity', color:'#e5f0ff', description:'Sharpens the feeling. A clear look at the thing between you.', line:'A little clarity, for once.'},
    {id:'warmth', name:'Warmth', color:'#f3bf76', description:'Softens the edges. Leave a little kindness in the glass.', line:'Warm at the edges, even where the story gets awkward.'},
    {id:'depth', name:'Depth', color:'#8e83c3', description:'Lets the feeling linger. Leave time for the second thought.', line:'Give this one a moment after the first sip.'},
    {id:'intensity', name:'Intensity', color:'#f17d81', description:'A stronger feeling. You clearly didn’t come here to hint.', line:'Rather more feeling than a polite nod could manage.'},
    {id:'bloom', name:'Bloom', color:'#e9d483', description:'Opens the feeling out. Room for something you haven’t said yet.', line:'A little room for whatever comes next.'},
    {id:'pure', name:'Pure', color:'#afbbcb', description:'Nothing added. The feeling can speak for itself.', line:'Served as it is. Sometimes that’s enough.'}
  ];
  const bottoms = [
    {id:'sorry', name:'I’m sorry.', description:'No qualifications at the bottom of the glass.'},
    {id:'miss-you', name:'I miss you.', description:'A small sentence with a spare chair in it.'},
    {id:'thank-you', name:'Thank you.', description:'Simple. Often overdue.'},
    {id:'was-wrong', name:'I was wrong.', description:'Best served without “but”.'},
    {id:'you-were-wrong', name:'You were wrong.', description:'We’ll let the glass take responsibility for that one.'},
    {id:'proud-of-you', name:'I’m proud of you.', description:'They ought to hear it from you.'},
    {id:'come-home', name:'Come home.', description:'There’s room. There always was.'},
    {id:'call-me', name:'Call me.', description:'No perfectly composed message required.'},
    {id:'still-think-about-it', name:'I still think about it.', description:'Some moments have a long aftertaste.'},
    {id:'love-you', name:'I love you.', description:'There it is.'},
    {id:'you-saved-me', name:'You saved me.', description:'However small it looked from their side.'},
    {id:'just-a-drink', name:'Nothing, I just wanted you to have a drink.', description:'An evening doesn’t always need a reason.'},
    {id:'favourite-idiot', name:'You’re my favourite idiot.', description:'Affection, stated with complete accuracy.'},
    {id:'your-idea', name:'It was definitely your idea.', description:'The glass has reviewed the evidence.'},
    {id:'keeping-hoodie', name:'I’m keeping the hoodie.', description:'Consider this formal notice.'},
    {id:'counts-as-replying', name:'This counts as replying.', description:'A carefully aged response.'},
    {id:'your-round-next', name:'Your round. Yes, still.', description:'The ledger has not forgotten.'},
    {id:'delete-voice-note', name:'Delete the voice note.', description:'That was meant to be a rehearsal.'},
    {id:'dont-tell-group-chat', name:'We are not telling the group chat.', description:'An agreement that may last several minutes.'},
    {id:'heard-karaoke', name:'I heard your karaoke. I stayed.', description:'There are many forms of loyalty.'},
    {id:'brain-cell-back', name:'You can have the brain cell back now.', description:'Please return it in working order.'},
    {id:'same-time-next-week', name:'We’re a terrible idea. Same time next week?', description:'A standing appointment.'},
    {id:'stop-being-sensible', name:'Stop being sensible. It’s unsettling.', description:'This is not the arrangement we agreed.'},
    {id:'not-sentimental', name:'No, I’m not getting sentimental. Drink it.', description:'We’ll give you a moment to compose yourself.'},
    {id:'like-me-with-you', name:'I like who I am when I’m with you.', description:'The comfortable version, with fewer rehearsed answers.'},
    {id:'made-it-easier', name:'You made that day easier.', description:'You might not know which day. I do.'},
    {id:'never-a-burden', name:'You never made me feel like a burden.', description:'Even when I thought I was.'},
    {id:'glad-it-was-you', name:'I’m glad it was you.', description:'I keep coming back to that.'},
    {id:'still-pick-you', name:'I’d still pick you.', description:'Yes, knowing all that.'},
    {id:'dont-have-to-be-funny', name:'You don’t have to be funny for me to want you here.', description:'You can have a quiet night, too.'},
    {id:'noticed-it-mattered', name:'I noticed. It mattered.', description:'The small thing you nearly didn’t do.'},
    {id:'kept-your-seat', name:'I kept your seat.', description:'Nobody else looked right in it.'},
    {id:'boring-bits-too', name:'You can tell me the boring bits too.', description:'I’d like to know what your day was like.'},
    {id:'miss-doing-nothing', name:'I miss doing nothing with you.', description:'We used to be very good at it.'},
    {id:'more-than-a-drink', name:'I owe you more than a drink.', description:'Let’s start with this one.'},
    {id:'just-company', name:'No fixing. Just company.', description:'Sit beside me for a while.'}
  ];
  // Titles, sources and palettes follow the actual After Hours playlist, including Redline.
  const tracks = [
    {id:'im-trouble', name:"I’m Trouble", title:"I'm Trouble", src:'/audio/sanctuary-after-hours/im-trouble.mp3', mood:'Velvet magenta', color:'#b05cff', duration:143.6},
    {id:'epic-british-anime-fight-scene-music', name:'Redline', title:'Redline', src:'/audio/sanctuary-after-hours/epic-british-anime-fight-scene-music.mp3', mood:'Electric blue', color:'#6574ff', duration:178.600167},
    {id:'be-my-friend', name:'Be My Friend', title:'Be My Friend', src:'/audio/sanctuary-after-hours/be-my-friend.mp3', mood:'Golden warmth', color:'#d6a85e', duration:117.320167},
    {id:'redwings', name:'Redwings', title:'Redwings', src:'/audio/sanctuary-after-hours/redwings.mp3', mood:'Ruby dusk', color:'#dc687d', duration:96.240979},
    {id:'dunk-no-jutsu', name:'Dunk No Jutsu', title:'Dunk No Jutsu', src:'/audio/sanctuary-after-hours/dunk-no-jutsu.mp3', mood:'Azure current', color:'#5c91ef', duration:80.720167},
    {id:'cute-to-the-core', name:'Cute to the Core', title:'Cute to the Core', src:'/audio/sanctuary-after-hours/cute-to-the-core.mp3', mood:'Rose quartz', color:'#e58bd3', duration:131.56},
    {id:'impact-drop-1', name:'Impact Drop 1', title:'Impact Drop 1', src:'/audio/sanctuary-after-hours/impact-drop-1.mp3', mood:'Amethyst surge', color:'#ad65e5', duration:151.16},
    {id:'impact-drop', name:'Impact Drop', title:'Impact Drop', src:'/audio/sanctuary-after-hours/impact-drop.mp3', mood:'Indigo embers', color:'#7c6cdd', duration:140.32},
    {id:'second-looks-good-on-you', name:'Second Looks Good on You', title:'Second Looks Good on You', src:'/audio/sanctuary-after-hours/second-looks-good-on-you.mp3', mood:'Midnight gold', color:'#d6b16d', duration:253.36},
    {id:'urban-jungle', name:'Urban Jungle', title:'Urban Jungle', src:'/audio/sanctuary-after-hours/urban-jungle.mp3', mood:'Emerald neon', color:'#4fc4a0', duration:163.16},
    {id:'little-shadow', name:'Little Shadow', title:'Little Shadow', src:'/audio/sanctuary-after-hours/little-shadow.mp3', mood:'Moonlit lilac', color:'#9a9fe8', duration:184.92}
  ];
  const suggestions = [
    {id:'long-tab', name:'The Long Tab', description:'Three measures of Still Here. One of Owes Me Money. Plenty of time to discuss it.', recipe:{glass:'celestial-tankard', ingredients:[{id:'still-here',parts:3},{id:'owes-me-money',parts:1}], seasoning:'warmth', stirred:true, bottom:'thank-you', track:'be-my-friend'}},
    {id:'neither-stirring', name:'Neither Of Us Is Stirring', description:'Love and Same Argument Again. Leave the layers. Someone has to start.', recipe:{glass:'duskkin-tankard', ingredients:[{id:'love',parts:2},{id:'same-argument-again',parts:2}], seasoning:'pure', stirred:false, bottom:'was-wrong', track:'im-trouble'}},
    {id:'quiet-thanks', name:'This One’s Overdue', description:'Never Said Thanks, with a little Courage. Straight to the point.', recipe:{glass:'crystal-shot', ingredients:[{id:'never-said-thanks',parts:3},{id:'courage',parts:1}], seasoning:'clarity', stirred:true, bottom:'thank-you', track:'be-my-friend'}},
    {id:'spare-seat', name:'Kept Your Seat', description:'Homecoming and Comfortable Silence. An unhurried invitation.', recipe:{glass:'celestial-tankard', ingredients:[{id:'homecoming',parts:2},{id:'comfortable-silence',parts:2}], seasoning:'warmth', stirred:true, bottom:'come-home', track:'little-shadow'}},
    {id:'bad-influence', name:'Absolutely Your Idea', description:'Mischief and Inside Joke. Try to keep a straight face.', recipe:{glass:'glowing-vial', ingredients:[{id:'mischief',parts:2},{id:'inside-joke',parts:2}], seasoning:'bloom', stirred:true, bottom:'just-a-drink', track:'im-trouble'}},
    {id:'make-call', name:'You Still Up?', description:'Three A.M. Call and Should Have Called. The number hasn’t changed.', recipe:{glass:'misted-glass', ingredients:[{id:'three-am-call',parts:3},{id:'should-have-called',parts:1}], seasoning:'depth', stirred:true, bottom:'call-me', track:'second-looks-good-on-you'}},
    {id:'shared-custody', name:'Shared Custody', description:'One Brain Cell and Same Bad Decision. The evidence suggests neither of you had it.', recipe:{glass:'duskkin-tankard', ingredients:[{id:'one-brain-cell',parts:2},{id:'same-bad-decision',parts:2}], seasoning:'bloom', stirred:true, bottom:'brain-cell-back', track:'dunk-no-jutsu'}},
    {id:'missing-minutes', name:'The Minutes Are Missing', description:'The Group Chat and For Legal Reasons. Leave a little uncertainty in the glass.', recipe:{glass:'duskkin-tankard', ingredients:[{id:'the-group-chat',parts:3},{id:'for-legal-reasons',parts:1}], seasoning:'pure', stirred:false, bottom:'dont-tell-group-chat', track:'im-trouble'}},
    {id:'read-receipt', name:'A Reply in Several Parts', description:'Left on Read and The Voice Note. It’s a long story. It always is.', recipe:{glass:'misted-glass', ingredients:[{id:'left-on-read',parts:2},{id:'the-voice-note',parts:2}], seasoning:'depth', stirred:true, bottom:'counts-as-replying', track:'second-looks-good-on-you'}},
    {id:'actually-thanks', name:'Qualified in Showing Up', description:'Emotional Support Idiot and Saved Me Slightly. A joke with a proper thank-you underneath.', recipe:{glass:'crystal-shot', ingredients:[{id:'emotional-support-idiot',parts:3},{id:'saved-me-slightly',parts:1}], seasoning:'warmth', stirred:true, bottom:'made-it-easier', track:'be-my-friend'}},
    {id:'walk-home', name:'The Long Way Round', description:'Walk You Home and Knows My Order. For the friend who remembers the little things.', recipe:{glass:'celestial-tankard', ingredients:[{id:'walk-you-home',parts:2},{id:'knows-my-order',parts:2}], seasoning:'warmth', stirred:true, bottom:'like-me-with-you', track:'little-shadow'}},
    {id:'permanent-loan', name:'On Permanent Loan', description:'Borrowed Hoodie and Found You Anyway. Warm, familiar, probably never being returned.', recipe:{glass:'bone-glass', ingredients:[{id:'borrowed-hoodie',parts:1},{id:'found-you-anyway',parts:3}], seasoning:'bloom', stirred:true, bottom:'keeping-hoodie', track:'cute-to-the-core'}}
  ];

  const ingredients = feelings.concat(regulars);
  const byId = Object.freeze(Object.assign(Object.create(null), Object.fromEntries(ingredients.map(item => [item.id, item]))));
  const pairs = [
    {ids:['still-here','owes-me-money'], name:'The Long Tab', toast:'Poured slowly, for someone who’s been around long enough to be in debt to.'},
    {ids:['love','same-argument-again'], name:'Neither Of Us Is Stirring', toast:'There’s love in there. It’s just refusing to mix with the other thing.'},
    {ids:['nostalgia','knew-you-before'], name:'Before the Good Haircut', toast:'For the person who remembers what you looked like before you got away with this one.'},
    {ids:['inside-joke','laughing-when-we-shouldnt'], name:'Don’t Look at Me', toast:'For somebody whose mere presence is a risk to your composure.'},
    {ids:['courage','never-said-thanks'], name:'This One’s Overdue', toast:'For an old kindness, and a thank-you that took a while to find its voice.'},
    {ids:['homecoming','comfortable-silence'], name:'Kept Your Seat', toast:'The chair’s still here. You don’t have to fill the silence.'},
    {ids:['mischief','inside-joke'], name:'Absolutely Your Idea', toast:'For an idea neither of you should be trusted to explain.'},
    {ids:['proud-quietly','glory'], name:'Make a Little Fuss', toast:'They’ve earned a proper toast. They can object after you’ve finished.'},
    {ids:['three-am-call','should-have-called'], name:'You Still Up?', toast:'You don’t need a crisis to ring. Hearing your voice would do nicely.'},
    {ids:['started-as-rivals','still-here'], name:'Annoyingly Good Company', toast:'To the person you meant to prove wrong, who somehow stayed for dinner.'},
    {ids:['joy','saved-me-slightly'], name:'Needed That Laugh', toast:'You may not have noticed what that little laugh did for the evening.'},
    {ids:['sadness','comfortable-silence'], name:'No Need to Explain', toast:'There’s a seat beside me. We can leave the rest until you fancy talking.'},
    {ids:['fear','three-am-call'], name:'Stay on the Line', toast:'Tell me when you’re through the door. I’m not going anywhere.'},
    {ids:['would-help-you-move','never-said-thanks'], name:'Mind the Doorframe', toast:'For the one who carried the awkward end, including bits that weren’t furniture.'},
    {ids:['growing-apart','should-have-called'], name:'Different Last Trains', toast:'We can start with an hour. We don’t have to catch up on everything tonight.'},
    {ids:['love','owes-me-money'], name:'Love on Credit', toast:'For somebody you love enough to stop keeping an entirely accurate total.'},
    {ids:['curiosity','mischief'], name:'Just Having a Look', toast:'A quick look. That was the agreement. Neither of you has honoured it.'},
    {ids:['nostalgia','homecoming'], name:'The Light Was On', toast:'For the place that feels familiar because the right person is in it.'},
    {ids:['one-brain-cell','same-bad-decision'], name:'Shared Custody', toast:'The brain cell was available. Neither of you thought to book it.'},
    {ids:['the-group-chat','for-legal-reasons'], name:'The Minutes Are Missing', toast:'For an evening the group chat will describe in a carefully selected series of unrelated messages.'},
    {ids:['left-on-read','the-voice-note'], name:'A Reply in Several Parts', toast:'Three weeks of silence, followed by eight minutes about a very strange pigeon. Good to hear from you.'},
    {ids:['emotional-support-idiot','saved-me-slightly'], name:'Qualified in Showing Up', toast:'You made a stupid joke at exactly the right moment. I remember the moment more than the joke.'},
    {ids:['walk-you-home','knows-my-order'], name:'The Long Way Round', toast:'You remembered my order and pretended my street was on your way. I noticed both.'},
    {ids:['borrowed-hoodie','found-you-anyway'], name:'On Permanent Loan', toast:'For the person who makes a crowded room familiar. Your hoodie has been doing a decent impression.'},
    {ids:['bad-influence','designated-adult'], name:'Somebody Has to Book It', toast:'One of you found the bad idea. The other has checked the last train. An excellent working arrangement.'},
    {ids:['no-context','inside-joke'], name:'The Spoon Is Relevant', toast:'It makes perfect sense if you were there. It makes things much worse if we explain.'},
    {ids:['your-round','owes-me-money'], name:'The Tab Has Questions', toast:'For somebody whose financial contribution remains a fascinating theoretical possibility.'},
    {ids:['still-on-mute','the-voice-note'], name:'We Asked for a Summary', toast:'You couldn’t hear me, so I sent the whole thing again. With several additional details.'},
    {ids:['emergency-contact','three-am-call'], name:'First on the List', toast:'You answered before I’d worked out what to say. That helped more than you know.'},
    {ids:['brought-snacks','would-help-you-move'], name:'Lift With Your Knees', toast:'You brought sandwiches, carried the sofa and only swore at the stairs. That’s proper friendship.'},
    {ids:['one-brain-cell','proud-quietly'], name:'Look What You Managed', toast:'I take back most of the brain cell jokes. You did something brilliant, and I wanted you to know.'},
    {ids:['the-group-chat','comfortable-silence'], name:'Notifications Muted', toast:'You can sit with us without having anything to report. The chat will cope without an update.'},
    {ids:['emotional-support-idiot','sadness'], name:'The Joke Can Wait', toast:'You don’t have to make this funny. I wanted your company before you learnt the routine.'},
    {ids:['bad-influence','still-here'], name:'An Ongoing Arrangement', toast:'A surprising number of questionable evenings. A reassuringly familiar person beside you.'},
    {ids:['walk-you-home','homecoming'], name:'Text Me When You’re In', toast:'For the person who waits for the message, even after watching you find your keys.'},
    {ids:['brought-snacks','never-said-thanks'], name:'You Remembered the Good Ones', toast:'It looked like a packet of biscuits. It felt like somebody had thought about me.'}
  ];
  const commonLines = [
    'Different orders. Same table. That’s usually enough to get an evening started.',
    'You’ve each brought something different to the bar. Pull the chairs a little closer.',
    'Two glasses with very different opinions. There’s room for both of you.',
    'Neither order quite explains the other. Perhaps that’s why the conversation works.',
    'A shared table is a decent place to start, even when the drinks disagree.',
    'You don’t have to want the same drink to want the same company.',
    'Between you, that’s enough feeling to keep the table occupied for a while.',
    'Different routes to the same bar. Take a seat before you explain yours.',
    'Both glasses have arrived. The sensible thing would be to stop comparing and talk.',
    'Two quite different pours, and somehow neither of you looks surprised.',
    'Your glasses don’t agree on much. They appear to be enjoying the company.',
    'A round for two people who have never ordered the same way and probably never will.'
  ];
  const hash = value => {
    let out = 2166136261;
    for (const char of String(value)) {out ^= char.codePointAt(0); out = Math.imul(out, 16777619);}
    return out >>> 0;
  };
  const safeRows = drink => (Array.isArray(drink?.ingredients) ? drink.ingredients : []).filter(item => item && typeof item.id === 'string' && byId[item.id]);
  const recipeKey = drink => JSON.stringify({glass:drink?.glass, ingredients:safeRows(drink).map(item => ({id:item.id,parts:item.parts})).sort((a,b) => a.id.localeCompare(b.id)), seasoning:drink?.seasoning, stirred:drink?.stirred, bottom:drink?.bottom, track:drink?.track});
  // The aftertaste names the actual choices. Changing a song or the private bottom
  // line never rerolls the relationship reading; names never affect its wording.
  function aftertaste(drink, base) {
    const glass = glasses.find(item => item.id === drink.glass);
    const seasoning = seasonings.find(item => item.id === drink.seasoning);
    const lines = [base];
    if (glass) lines.push(glass.line);
    if (seasoning && seasoning.id !== 'pure') lines.push(seasoning.line);
    if (safeRows(drink).length === 2 && !drink.stirred) lines.push('Left in layers. No need to agree on everything.');
    return lines.join(' ');
  }
  function renderToast(drink) {
    const rows = safeRows(drink);
    if (!rows.length) return {name:'A Seat at the Bar', toast:'Choose something for the glass. The chair’s already yours.'};
    const ids = rows.map(item => item.id);
    const paired = pairs.find(item => item.ids.length === ids.length && item.ids.every(id => ids.includes(id)));
    if (paired) {
      if (paired.name === 'Neither Of Us Is Stirring' && drink.stirred) return {name:'Someone Stirred First', toast:aftertaste(drink, 'The same feelings, given a little room to meet. Someone had to make the first move.')};
      const exactLongTab = paired.name === 'The Long Tab' && drink.glass === 'celestial-tankard' && drink.seasoning === 'warmth' && rows.find(item => item.id === 'still-here')?.parts === 3 && rows.find(item => item.id === 'owes-me-money')?.parts === 1 && drink.stirred;
      return {name:paired.name, toast:exactLongTab ? paired.toast : aftertaste(drink, paired.toast)};
    }
    const sorted = rows.slice().sort((a,b) => Number(b.parts)-Number(a.parts) || a.id.localeCompare(b.id));
    const primary = byId[sorted[0].id];
    const seed = hash(JSON.stringify(sorted.map(item => ({id:item.id,parts:item.parts}))));
    let name = primary.title;
    if (sorted.length === 2 && !drink.stirred && drink.glass === 'duskkin-tankard') name = 'It’s Complicated';
    return {name, toast:aftertaste(drink, primary.lines[seed % primary.lines.length])};
  }
  function commonRoundLine(a,b) {
    const first = safeRows(a).map(item => item.id);
    const second = safeRows(b).map(item => item.id);
    const shared = first.filter(id => second.includes(id) && byId[id]).sort();
    if (recipeKey(a) === recipeKey(b)) return 'The same order. Neither of you gets to pretend that’s a coincidence.';
    if (shared.includes('still-here')) return 'Both glasses have Still Here in them. You appear to have settled the important bit.';
    if (shared.includes('inside-joke')) return 'You both reached for Inside Joke. The rest of the bar can fend for itself.';
    if (shared.includes('love')) return 'You both put Love in the glass. There’s a promising place to start.';
    if (shared.includes('comfortable-silence')) return 'A little Comfortable Silence in both glasses. We’ll leave you to it.';
    if (shared.includes('same-argument-again')) return 'You both brought Same Argument Again. At least nobody can claim to be surprised.';
    if (shared.includes('one-brain-cell')) return 'One Brain Cell in both glasses. We appear to be dividing it further.';
    if (shared.includes('the-group-chat')) return 'You both reached for The Group Chat. At last, two members have agreed on something.';
    if (shared.includes('emotional-support-idiot')) return 'A little Emotional Support Idiot in both glasses. Apparently you’ve been taking turns.';
    if (shared.includes('walk-you-home')) return 'You both poured Walk You Home. Deciding who leaves first could take a while.';
    if (shared.includes('knows-my-order')) return 'Knows My Order, in both glasses. You seem to have been paying attention to each other.';
    if (shared.includes('brought-snacks')) return 'You both thought to bring snacks. This table has its priorities in order.';
    if (shared.length) return `Different pours, with a little ${byId[shared[0]].name} in both. Something to start with.`;
    const keys = [recipeKey(a),recipeKey(b)].sort().join('|');
    return commonLines[hash(keys) % commonLines.length];
  }
  const api = {version:1, feelings, regulars, glasses, seasonings, bottoms, tracks, suggestions, ingredients, byId, renderToast, commonRoundLine};
  // 252 ingredient toasts + 36 pair toasts + 12 common-round lines; all authored.
  api.lineCount = feelings.concat(regulars).reduce((sum,item) => sum+item.lines.length,0) + pairs.length + commonLines.length;
  return Object.freeze(api);
});

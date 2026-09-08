import { createHash } from 'node:crypto';

// Authored banter for the Demon's Legion. Nothing here is generated at runtime
// and no model is called: the world picks a written exchange with a seeded
// hash, exactly as the Goaden/Ashai conversations do.
//
// The Legion is a crew and a band. The warehouse has a drum kit, the Sanctuary
// has a stage, and the reunion scene is a sword duel staged as a gig [M228]. So
// the register is band-in-a-van, not operatives-in-a-briefing: piss-taking,
// absurd escalation, and somebody sulking in the corner about billing.
//
// Voice, all of it from the manuscript rather than invented:
//
//   Truth  — fronts the band, booming and profane-affectionate. Calls Goaden
//            "Reever". "Wanna shatter sound barriers with us cretins one last
//            time?" … "I've a show to finish, so fuck off!" [M229] The Legion
//            voted him leader after Goaden left [M103] and he wears it like a
//            man running a pub quiz: total authority, no dignity. He has plates
//            now, so he is on screen rather than only talked about.
//
//   Anarchy— the drummer and the hype man. "OHHH SHIT!!" over a drum kit
//            [M228], and the one who defuses: "Leave him be. His bark's worse
//            than his bite!" [M229] Soul-bonded to the Demon Balthazar, whose
//            fingers flicker into view alongside his own [M99].
//   Gabriel— the rapper. Third strongest and cannot let it go; scowls, spits,
//            spins away with his blood-wings "arched brooding" [M229]. Loud,
//            dramatic, insecure, entirely lovable. The engine of most jokes.
//   Rose   — "soft features implacable as stone", and the reunion gets from her
//            "the barest approving nod" [M228-229]. Talks to birds [M101].
//            Says the fewest words and wins the exchange with them.
//   Balthazar— an ancient Demon riding along inside somebody's afternoon. The
//            comedy is entirely in the contrast: cosmic dread, mundane subject.
//
// On the language, by author instruction, reversing an earlier pass that had
// quietly dialled it down: the swearing is part of the IP and belongs here.
// The manuscript carries twenty-three uses of one word and thirty-six of
// another, nearly all of them before the p.183 checkpoint and nearly all of
// them inside quotation marks — "I'll bet my favourite bass we see some fuck
// up" [M813], "Yeah fucking hilarious" [M838], "How 'bout you try keepin' that
// shit to yourself, Gabe?" [M829], "Come on, you piece of shit" [M818]. So it
// goes in dialogue rather than narration, it is casual rather than aggressive,
// and it is how this crew is affectionate. Goaden drops his g's — "fuckin'",
// "keepin'", "mornin'", "gunna", "tryin'a" — and everybody uses contractions,
// because a bank that writes "I am not telling Truth that" is not writing
// anybody in this book.
//
// Two rails, both inherited rather than new. Nothing in here changes a fact,
// teaches anybody anything or moves a plan — a scene is lines and nothing else,
// the same as every Goaden/Ashai conversation since v10. And nothing references
// anything past the p.183 checkpoint.
export const LEGION_SPEAKERS = Object.freeze(['goaden','ashai','rose','anarchy','balthazar','gabriel','truth','damien']);
// The plate files that actually exist in public/scene, so a written line can
// only ask for art the world owns.
export const LEGION_PLATES = Object.freeze({
  rose:['idle','annoyed','cheeky','happy','intense','observation','sad'],
  anarchy:['idle','curious','grin','intense','smirk','surprised'],
  balthazar:['idle','smirk','smolder','smolder2'],
  gabriel:['annoyed','frown','humble','impressed','laughing','showing-off','surprised','thinking'],
  // No idle plate, which suits him: Truth has no resting face.
  truth:['annoyed','disgust','laughing','shock','stern','idle'],
  // One plate, so he is written the way a man with one face is written: dry,
  // short, and only when it is worth it.
  damien:['idle'],
});
export const LEGION_MOODS = Object.freeze(['billing','gig','domestic','the_quiet_one','demon_admin','frontman']);

const g = (expression,text) => ({who:'goaden',expression,text});
const a = (expression,text) => ({who:'ashai',expression,text});
const r = (expression,text) => ({who:'rose',expression,text});
const n = (expression,text) => ({who:'anarchy',expression,text});
const b = (expression,text) => ({who:'balthazar',expression,text});
const x = (expression,text) => ({who:'gabriel',expression,text});
const t = (expression,text) => ({who:'truth',expression,text});
const d = (expression,text) => ({who:'damien',expression,text});

export const LEGION_EXCHANGES = Object.freeze({
  // Gabriel is the third strongest and it is a wound. The manuscript has him
  // spitting and storming off about exactly this, so the bank leans on it.
  billing:[
    [x('annoyed','Third. Still third. I\'ve got wings made of my own blood and I\'m third.'),
     n('grin','You\'re third out of a lot of people, bruv.'),
     x('showing-off','Out of SIX, Anarchy. Six! That\'s barely a fucking queue.'),
     r('cheeky','You were third last week as well and you managed.'),
     x('frown','I didn\'t manage. I\'ve been coping.')],
    [x('thinking','If you think about it, second and third are basically the same.'),
     n('smirk','Go on then. Tell Truth that.'),
     x('surprised','I\'m not telling Truth that.'),
     n('grin','No.')],
    [g('smirk','Still third, yeah?'),
     x('annoyed','You do not get to say it. You LEFT, mate. You aren\'t even on the bloody board.'),
     g('idle','So I\'m nowhere and you\'re third.'),
     x('frown','...I hate that that\'s worse.')],
    [x('showing-off','I\'ve been practising a new one. Blood javelin.'),
     r('idle','Blood what.'),
     x('impressed','Javelin. Like the sport.'),
     r('annoyed','Gabriel, you fainted giving a pint at the drive.'),
     x('frown','That was DIFFERENT. That was going in a bag!')],
    // Treatment 80, "Gabriel's Bad Night": missed entries, a dead microphone,
    // and a crowd that did not carry him. His plan is to fight the reviews.
    [x('annoyed','Right. I want names.'),
     n('curious','Names of what?'),
     x('showing-off','Everyone who said anything. I\'m going round. One at a time. Politely.'),
     r('idle','Go on then. I want to watch.'),
     x('frown','I\'ll be polite, Rose.'),
     r('cheeky','You\'ll get to the second door and ask if they liked the bridge.'),
     n('grin','He\'ll be polite and arrested.'),
     x('humble','...The mic was dead for the whole bloody second verse.'),
     r('idle','I know. Everyone knows. That\'s not what they said, though, is it.')],
    [g('idle','Heard you had a night.'),
     x('annoyed','I don\'t want to talk about it.'),
     g('smirk','Course not.'),
     x('frown','It was the sound.'),
     g('idle','Yeah.'),
     x('showing-off','And the room! It was a bad room, Goaden.'),
     g('amused','It was a room you\'ve done nine times.'),
     x('surprised','...'),
     g('idle','Come on. Do the second verse. I\'ll be the crowd and I\'ll be a right prick about it.'),
     x('laughing','You\'re enjoying this far too much.'),
     g('smirk','I\'m enjoying it exactly the right amount, mate.')],
    [x('impressed','Better tonight.'),
     n('grin','It was.'),
     x('humble','The sound was slightly less shit.'),
     n('smirk','That\'s the review, is it.'),
     x('frown','That\'s the review.'),
     r('cheeky','Write it down. He\'ll deny it Thursday.')],
  ],
  // The band. Load-in, sound, the rider, the eternal argument about the set.
  gig:[
    [n('grin','Sanctuary again Friday. Truth wants the long version of the closer.'),
     x('annoyed','The long version is nine minutes.'),
     n('curious','It\'s eleven now.'),
     x('surprised','ELEVEN? Eleven fucking minutes?'),
     r('cheeky','He added a bit where he talks.')],
    [g('idle','You lot still doing the thing where the drums go on too long?'),
     n('grin','That\'s called a solo, Reever.'),
     g('smirk','It\'s called too long.'),
     n('intense','It\'s FOUR MINUTES, mate.'),
     a('soft_smile','That does sound quite long.'),
     n('surprised','Not you as well.')],
    [x('impressed','Crowd was mental last night. Absolutely mental.'),
     r('observation','There were forty of them.'),
     x('showing-off','Forty MENTAL people.'),
     r('idle','One of them was your mum.'),
     x('humble','She counts double.')],
    [n('curious','We need a name for the tour.'),
     x('thinking','The Blood Angel Ascends.'),
     r('annoyed','No.'),
     x('frown','You haven\'t even heard the subtitle.'),
     r('idle','No.')],
    // Treatment 73, "One Song, No Reunion Announcement". He said yes to one
    // arrangement. By Tuesday somebody outside the room had him back in the
    // band. Truth is angrier about it than Goaden is, which is the joke.
    [t('annoyed','Reever. Have you seen what\'s going round?'),
     g('idle','I have, yeah.'),
     t('stern','It says returning. It says returning in big letters.'),
     g('smirk','It does.'),
     t('annoyed','It\'s one song! You said one song, I said one song, we shook on one fucking song—'),
     g('amused','Truth.'),
     t('stern','—and now I\'ve got people asking me about a tour.'),
     g('idle','So say it\'s one song.'),
     t('disgust','I HAVE said it\'s one song. Nobody wants that version.')],
    [x('showing-off','If he\'s back, the running order changes.'),
     n('curious','He\'s not back.'),
     x('annoyed','If, Anarchy. If. Hypothetically. Where am I?'),
     n('grin','Hypothetically third.'),
     x('frown','I\'ll break something.')],
    [g('idle','Right. Once through, then I\'m off.'),
     t('laughing','Once through. Everybody hear that? Once through, and then the man goes home to his desk job.'),
     g('smirk','It\'s not a desk job.'),
     t('stern','You have a lanyard.'),
     g('amused','Play the bloody song, Truth.')],
    // Treatment 74, "The Borrowed Bass". Yukon has no plates, so he is talked
    // about rather than shown, which is also how the manuscript treats a man
    // who is not currently in the room and would rather stay that way.
    [n('surprised','So the neck\'s cracked.'),
     x('surprised','WHAT.'),
     n('idle','Hairline. Behind the fifth. He\'s had it three weeks.'),
     x('annoyed','Three WEEKS? He\'s been sat on it for three weeks?'),
     n('grin','He was going to fix it first and then tell us. That was the whole bloody plan.'),
     r('cheeky','That\'s always the plan. Has it worked yet? Once?'),
     g('idle','He tell you, or did you find it?'),
     n('smirk','He told me. Took him about forty minutes to get to the point and I let him.')],
    [g('idle','I ain\'t buying him a new one.'),
     n('curious','Nobody asked you to.'),
     g('smirk','He\'ll ask.'),
     n('grin','He\'ll ask, yeah.'),
     g('idle','And he can pay for the repair and carry the thing there himself.'),
     r('idle','Good.'),
     g('amused','You lot reckon I\'m being harsh.'),
     r('observation','No. I think you\'ve met him.')],
    // Treatment 82, "The Track That Isn't Theirs". Somebody put a record out
    // under their name pointed at a specific community. Denying it is easy and
    // is not the same as fixing it.
    [t('shock','It\'s got my ad-lib on it.'),
     n('intense','It\'s got a copy of your ad-lib on it.'),
     t('disgust','It\'s got my ad-lib and my name and it\'s telling people to go down there and do something about it. That isn\'t a song. That\'s somebody handing out a reason.'),
     r('intense','Take it down and they\'ll say you got caught.'),
     t('stern','I know.'),
     r('idle','So don\'t start with the file. Start with the street.'),
     t('annoyed','...Yeah.'),
     g('idle','I\'ll come.'),
     t('stern','You\'ll not. This one\'s ours and it needs to look like it.')],
    // Damien has one plate and is written for it: he arrives, says the shortest
    // true thing in the room, and stops. [M813] is him betting his own bass
    // against his crew, and [M838] is "Yeah fucking hilarious" delivered flat.
    [d('idle','It\'s the second half.'),
     x('showing-off','The second half is the best part of it.'),
     d('idle','It\'s the second half.'),
     n('grin','He\'s said that four times now.'),
     x('annoyed','And he hasn\'t said WHY once!'),
     d('idle','Because you\'d argue.'),
     x('frown','...I would argue.')],
    [n('curious','Damien. Settle it. Nine minutes or eleven.'),
     d('idle','Nine.'),
     x('surprised','You haven\'t heard the eleven!'),
     d('idle','I\'ve heard the eleven.'),
     x('annoyed','And?'),
     d('idle','Nine.')],
  ],
  // Ordinary life happening to people who can fly. The joke is the smallness.
  domestic:[
    [r('idle','Somebody has been watering my ferns with fizzy water.'),
     n('surprised','That wasn\'t me.'),
     x('thinking','Why would that even hurt them?'),
     r('intense','Gabriel.'),
     x('frown','It was FLAT! It had gone flat!')],
    [x('annoyed','Right. Who ate the last of it. WHO.'),
     n('grin','Mate, it had your name on it in marker.'),
     x('surprised','So you KNEW.'),
     n('smirk','I knew.')],
    [a('neutral','Does it not get cold in that warehouse?'),
     n('grin','Freezing. Absolutely arctic.'),
     r('cheeky','He won\'t let us fix the skylight. He says it\'s the vibe.'),
     n('intense','It IS the vibe.'),
     g('smirk','It\'s a hole, bro. It\'s a bloody hole in your roof.')],
    [r('happy','The pigeon is back.'),
     n('curious','Which pigeon.'),
     r('idle','The one with opinions.'),
     n('grin','Ah. That pigeon.')],
    // Treatment 77, "No Demonic Arms on the Court". Anarchy played a local game
    // under ordinary rules. [M99-100]: he was an athlete before the bond, which
    // is the entire point Goaden refuses to accept.
    [g('idle','You cheated.'),
     n('grin','I didn\'t cheat.'),
     g('smirk','Twenty-two points, mate.'),
     n('idle','I played basketball for eleven years before a Demon ever spoke to me.'),
     g('idle','Convenient.'),
     n('smirk','It\'s not convenient, it\'s a childhood.'),
     g('amused','I watched your hands the entire second half.'),
     n('grin','I know you did. It was weird and everybody noticed.')],
    [b('smirk','Might I offer an observation.'),
     n('surprised','No.'),
     b('idle','Not one of you can pass. Not one. I have watched armies hold a shape better than that, and they were losing.'),
     n('intense','You stood at the side. You didn\'t touch the bloody ball once.'),
     b('smolder','I did not need to touch the ball to watch it go to nobody.'),
     g('smirk','He\'s got a point about the passing.'),
     n('intense','Do not take his side. Not on passing.')],
    [n('curious','Kid asked if I\'m coming back next week.'),
     g('idle','And?'),
     n('grin','Yeah, I\'m coming back next week.'),
     g('smirk','Right. Rematch.'),
     n('smirk','You don\'t play.'),
     g('amused','I\'ll play. It\'s for science.'),
     n('grin','It\'s not for science.'),
     g('idle','It\'s a bit for science.')],
    [g('smirk','Alright, Damien.'),
     d('idle','Reever.'),
     g('idle','You still betting against this lot?'),
     d('idle','Every week. I\'m up.'),
     n('grin','He is not up.'),
     d('idle','I\'m up on Gabriel.'),
     n('smirk','...He\'s up on Gabriel.')],
  ],
  // Rose says four words and takes the whole scene. That is the bit.
  the_quiet_one:[
    [x('showing-off','Right, so, hear me out —'),
     r('idle','No.'),
     x('surprised','You haven\'t heard me out.'),
     r('observation','I have known you six years.')],
    [n('curious','Rose. Settle something for us.'),
     r('idle','No.'),
     n('grin','You do not know what it is.'),
     r('cheeky','I know who is asking.')],
    [g('idle','You\'ve been quiet.'),
     r('observation','Everyone else is being loud. It balances.'),
     g('smirk','That\'s very zen of you.'),
     r('cheeky','It\'s very tiring of me, is what it is.')],
    [a('thoughtful','Can you actually talk to them? The birds?'),
     r('happy','Yes.'),
     a('soft_smile','What do they say?'),
     r('idle','Mostly they\'re cross about something.'),
     a('amused','Relatable.')],
    // Treatment 78, "Rose and the Empty Nesting Boxes". [M101]: she holds a
    // conversation with a bird. That is the ability doing ordinary work — the
    // answer is night drilling, not an omen, and the birds do not come straight
    // back just because the drilling stopped.
    [r('observation','Six boxes. All empty.'),
     a('thoughtful','Since when?'),
     r('idle','A fortnight. Maybe more, I only counted properly on Sunday.'),
     a('guarded','Is it a sign of something?'),
     r('annoyed','Everyone asks that. No. They\'re not oracles, they\'re tenants.'),
     a('neutral','So what did they tell you?'),
     r('intense','Same thing, all of them, and none of it interesting. Something goes on at two in the morning and it doesn\'t stop until four.')],
    [a('neutral','It\'s the third floor. Unlicensed night work, no notices up, and they\'ve been at it a month.'),
     r('idle','Right.'),
     a('thoughtful','It\'s stopped. As of Thursday.'),
     r('sad','They won\'t come back for that.'),
     a('vulnerable','No?'),
     r('idle','Not this year. Maybe not next. You don\'t get a thing back the week you stop breaking it.'),
     a('thoughtful','Then why did we do it?'),
     r('observation','Because the year after that.')],
    [r('happy','Box four.'),
     a('surprised','No.'),
     r('cheeky','Two of them. Been in since Tuesday and I\'ve said nothing all week in case I jinxed it.'),
     a('soft_smile','Rose.'),
     r('idle','Don\'t.'),
     a('amused','You\'re grinning.'),
     r('happy','I\'m aware of what I\'m doing with my face, thank you.')],
    // Treatment 83, "Rose's Small Boundary". Everyone volunteers her. The
    // refusal is not a falling-out; it is the first time anybody counts.
    [a('neutral','I said you\'d have a look at the courtyard.'),
     r('idle','No.'),
     a('surprised','...Oh.'),
     r('annoyed','I did the yard behind the chippy. I did the roots under the platform. I did Gabriel\'s window box, twice, because he killed it twice.'),
     a('vulnerable','I didn\'t know it was that many.'),
     r('idle','No. Nobody does. That\'s how it gets to be that many.'),
     a('thoughtful','Right. I\'ll do the courtyard.'),
     r('cheeky','You\'ll do it with a fork and a bag and it\'ll take you all Sunday.'),
     a('amused','Yes.'),
     r('happy','Then I\'ll come and sit with you and say nothing useful.')],
  ],
  // An ancient Demon obliged to be present for very small human problems.
  demon_admin:[
    [b('smolder','I have watched three cities come down.'),
     n('grin','Yeah, and?'),
     b('idle','And you are asking me about a parking ticket.'),
     n('smirk','You were driving.')],
    [x('annoyed','Balthazar. Settle it. Am I third?'),
     b('smirk','You are third.'),
     x('surprised','You didn\'t even think about it.'),
     b('smolder2','I did. For a very long time.')],
    [b('idle','Something is coming.'),
     r('annoyed','Is it the bus.'),
     b('smolder','...It is the bus.'),
     n('grin','He does this.')],
    [g('idle','How do you two even split the day?'),
     n('curious','We do not, really. He\'s just sort of there.'),
     b('smirk','I am always here.'),
     n('surprised','Bit much, mate.'),
     b('idle','You said we should communicate more.')],
    // Treatment 84, "Balthazar and the Damage Deposit". An ancient Demon and an
    // itemised invoice. Nothing he can do to it will make it stop existing.
    [n('surprised','Four hundred and ten.'),
     b('idle','For what.'),
     n('idle','Two chairs, a light fitting, and making good the plaster.'),
     b('smolder','Making good the plaster.'),
     n('grin','That\'s what it says.'),
     b('smirk','I have put cities in the ground, and this is about chairs.'),
     n('smirk','Yeah, and they\'ve unbooked us for the twelfth, so pay the man.'),
     b('smolder2','...Read me the item about the chairs again.')],
    [b('idle','I have considered the invoice.'),
     g('smirk','Go on.'),
     b('smolder','No.'),
     g('idle','It\'s four hundred quid, mate.'),
     b('smolder2','Not at four hundred, not at four. Do not talk to me about the plaster again.'),
     n('grin','He\'s paying it.'),
     b('idle','I am paying it.')],
    [n('grin','He met us at the door with a clipboard.'),
     g('amused','No.'),
     n('smirk','Clipboard. Went round the whole room with him. Ticked things off.'),
     b('smolder','I was shown a chair. I was asked to confirm the chair. I confirmed the fucking chair.'),
     g('smirk','And did you confirm the chair?'),
     b('idle','Twice. He made me do it twice.'),
     g('amused','I\'m coming to every rehearsal from now on.')],
  ],
  // Truth runs the Legion the way a man runs a pub quiz: absolute authority,
  // no dignity whatsoever. He is the loudest thing in any room he is in and he
  // is warm about it, which is the whole joke — the leader of the Demon's
  // Legion, and his agenda item is the van.
  //
  // Deliberately written so several of these need nobody but him: a scene the
  // pair can have with one visitor is the difference between the crew turning
  // up and the crew turning up in a coach.
  frontman:[
    [t('laughing','REEVER! Look at this guy. He has come in a JACKET.'),
     g('smirk','It\'s a jacket, yeah.'),
     t('stern','It has got a lining, Reever. That\'s a coat with ambitions.'),
     a('amused','He irons it.'),
     t('shock','He IRONS it!')],
    [t('annoyed','Who has moved my mic stand.'),
     r('observation','You moved your mic stand.'),
     t('stern','...I moved my mic stand.'),
     r('idle','Yes.'),
     t('laughing','Somebody should have stopped me, babe.')],
    [b('smolder','I have been summoned. To the load-in.'),
     t('stern','You\'ve got hands, big man. Two of them. Put them on that amp.'),
     b('idle','I have ended a kingdom, boy.'),
     t('laughing','And now you\'re doing the stairs! Life comes at you fast.'),
     b('smolder2','I will remember this for four hundred years.')],
    [t('stern','Set list. Nine tracks. No discussion.'),
     x('annoyed','I get a verse in three of them.'),
     t('disgust','You get a verse in three of them because you get through a verse in three of them.'),
     x('frown','That\'s the same sentence twice.'),
     t('laughing','It is. And it\'s still true!')],
    [n('curious','Truth. Is eleven minutes too long for a closer.'),
     t('stern','No.'),
     n('grin','Gabriel says it is.'),
     t('disgust','Gabriel thinks a fringe is a personality.'),
     n('smirk','So that\'s a no.'),
     t('laughing','That\'s a twelve!')],
    [t('stern','Right. Van. Everybody in.'),
     a('neutral','How many of you fit in a van?'),
     t('shock','Fit is a strong word.'),
     g('idle','How many.'),
     t('laughing','Six. And Balthazar doesn\'t count, he\'s luggage.')],
    // "Always was obsessed with history" — Goaden, on Truth keeping the blade
    // anthem alive at the reunion [M229]. The best joke in the bank is the one
    // the manuscript handed over.
    [t('stern','Reever. The blade anthem. What year.'),
     g('idle','No.'),
     t('annoyed','WHAT YEAR.'),
     g('smirk','...Eighty-nine.'),
     t('laughing','NINETY-ONE! You played it six years and you don\'t know when it\'s from!'),
     a('amused','Does it matter?'),
     t('shock','Does it — does it MATTER. Sit down, both of you. I\'m getting the book.')],
    [t('annoyed','You\'re off the board, Reever, and I want you to know it eats at me.'),
     g('smirk','Take me off the wall, then.'),
     t('stern','The wall isn\'t about you. The wall is a historical record.'),
     a('amused','His name is on it in gold.'),
     t('disgust','That\'s the paint we had.')],
    [t('laughing','Bring her Friday. Front of house, the pair of you.'),
     a('soft_smile','Is there a guest list?'),
     t('stern','There\'s a bit of card. I write on it. That\'s a guest list.'),
     g('smirk','It\'s a beer mat.'),
     t('shock','It\'s a LAMINATED beer mat!')],
    // Treatment 81, "Truth Says No". The refusal is not about Goaden, and it
    // takes him most of a week to hear that. [M103]: they voted Truth leader
    // after Goaden left, and a leader has people already counting on him.
    [g('idle','Friday. Could do with the six of you, if you\'re about.'),
     t('stern','Can\'t.'),
     g('surprised','You haven\'t heard what it is.'),
     t('annoyed','Doesn\'t matter what it is, Reever, I\'ve already said yes to somebody else for Friday.'),
     g('idle','Right.'),
     t('stern','Don\'t do that.'),
     g('deflect','I didn\'t do anything.'),
     t('disgust','You did the fucking voice.')],
    [a('neutral','He said no to a night, not to you.'),
     g('guarded','Feels like a bit of both.'),
     a('tired','Goaden. They had somewhere to be before you rang. They\'ve had somewhere to be for two years.'),
     g('idle','...Yeah.'),
     a('thoughtful','You get to have left and still be wanted. You don\'t also get first refusal on their Fridays.'),
     g('amused','That\'s a horrible sentence.'),
     a('soft_smile','It\'s an accurate one.')],
    [g('idle','How\'d Friday go, then?'),
     t('shock','...'),
     g('smirk','What?'),
     t('laughing','Nothing. Nothing! Ask me again, go on.'),
     g('amused','How did Friday go.'),
     t('stern','It went long and it went well and there were nineteen of them and not one got touched.'),
     g('idle','Good.'),
     t('laughing','LOOK at him. Asking questions. Listening to the answers.')],
    // Treatments 75 and 76, the bandanna and the trial. The standard does not
    // move for anybody, and the person who fails is still a person afterwards.
    [t('stern','Somebody\'s selling a bandanna in the market.'),
     g('idle','A real one?'),
     t('annoyed','A real one. Nicked off a kid who\'s been sleeping with it under her head for a year waiting on a trial date.'),
     g('smirk','And the seller thinks it\'s a souvenir.'),
     t('disgust','The seller has it next to a signed drumstick and a fucking mug.'),
     g('idle','Right. Market shuts at six.'),
     t('laughing','It does, yeah.')],
    [t('stern','She went out at three minutes and eleven seconds.'),
     r('idle','Close.'),
     t('annoyed','Close isn\'t three minutes.'),
     r('observation','No.'),
     t('stern','And I\'m not moving it. Not for her, not for anyone. The whole thing is that it doesn\'t move.'),
     r('idle','Nobody asked you to.'),
     t('disgust','Gabriel asked me to.'),
     r('cheeky','Gabriel asks you to move everything.')],
    [g('idle','She hand the kit back, then?'),
     t('stern','Cleaned. Folded. Thanked every one of us by name and then went and sat on the wall for an hour.'),
     g('idle','And?'),
     t('laughing','And she was back on the wall Tuesday, running it again on her own with a watch.'),
     g('smirk','Three eleven.'),
     t('stern','Three oh six on Tuesday, Reever. On her own, in the rain, with nobody watching but me.')],
  ],
});

// Which bank fits the moment. Deliberately simple, and weighted by who is
// actually in the room: Balthazar's bank needs Balthazar, and Rose's needs Rose.
export function legionMoodFor({ cast = [], weatherCode = 'cloudy', atSanctuary = false } = {}, seed = '', key = '') {
  const has = who => cast.includes(who);
  const candidates = [];
  if (has('gabriel')) candidates.push('billing');
  if (atSanctuary || has('anarchy')) candidates.push('gig');
  if (has('rose')) candidates.push('the_quiet_one');
  if (has('balthazar')) candidates.push('demon_admin');
  // Twice, because when Truth is in the room Truth is what the room is about.
  if (has('truth')) candidates.push('frontman', 'frontman');
  candidates.push('domestic');
  const index = createHash('sha256').update(`${seed}|legion-mood|${key}`).digest().readUInt32BE(0) % candidates.length;
  return candidates[index];
}
// Seeded, so a given moment always plays the same scene and a replay is a no-op.
export function selectLegionExchange(mood, seed, key) {
  const bank = LEGION_EXCHANGES[mood] ?? LEGION_EXCHANGES.domestic;
  const index = createHash('sha256').update(`${seed}|legion|${mood}|${key}`).digest().readUInt32BE(0) % bank.length;
  return bank[index].map(line => ({ ...line }));
}
// Everyone a given exchange actually needs on screen, in the order they speak.
export const castOf = lines => [...new Set(lines.map(line => line.who))];
export const legionCastOf = lines => castOf(lines).filter(who => who in LEGION_PLATES);

// Pick a scene that the people who turned up can actually perform.
//
// Choosing a mood from the visitors and then an exchange from that bank was
// wrong: a bank is grouped by subject, not by cast, so the `domestic` bank
// could hand three visitors a scene that needs a fourth. Every exchange is
// therefore filtered against who is here before anything is chosen, and the
// scene's own cast is authoritative — if the writing needs Rose, Rose came.
export function selectLegionScene({ available = [], seed = '', key = '', weatherCode = 'cloudy', atSanctuary = false } = {}) {
  const performable = [];
  for (const [mood, bank] of Object.entries(LEGION_EXCHANGES)) {
    for (const lines of bank) {
      if (legionCastOf(lines).every(who => available.includes(who))) performable.push({ mood, lines });
    }
  }
  // A scene cannot summon an absent or already committed cast member.
  if (!performable.length) return null;
  const pool = performable;
  // Prefer the mood the moment suggests, when the cast can manage it.
  const wanted = legionMoodFor({ cast: available, weatherCode, atSanctuary }, seed, key);
  const preferred = pool.filter(item => item.mood === wanted);
  const chosen = preferred.length ? preferred : pool;
  const index = createHash('sha256').update(`${seed}|legion-scene|${key}`).digest().readUInt32BE(0) % chosen.length;
  const picked = chosen[index];
  const lines = picked.lines.map(line => ({ ...line }));
  return { mood: picked.mood, lines, cast: legionCastOf(lines) };
}
// One line of feed text for a scene the page may not be rendering in full.
export function summariseLegion(mood) {
  return {
    billing:'Gabriel raised the matter of the rankings again.',
    gig:'The Legion argued about the set list.',
    domestic:'The Legion had a disagreement about the warehouse.',
    the_quiet_one:'Rose ended a conversation with four words.',
    demon_admin:'Balthazar was consulted about something beneath him.',
    frontman:'Truth came round and made the afternoon everybody else\'s problem.',
  }[mood] ?? 'The Legion were around, being themselves.';
}

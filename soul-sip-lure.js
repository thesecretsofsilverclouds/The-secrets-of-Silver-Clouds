/* Soul Sips discovery layer.
 *
 * The Codex notices you, a Lintel flies over to say something, and the lore page
 * quietly contains a door into the bar.
 *
 * TWO SURFACES, ONE SCRIPT — the same shape `global-shrine.js` uses: one IIFE
 * that injects its own CSS and returns immediately on pages it does not serve.
 *
 *   /            the Codex. The Soul Sips card glows; the Lintel delivers four lines.
 *   /soul-sips   the lore page. Faint warmth, one silent drift-by, CLOCK IN.
 *
 * THE LINTEL IS A PORT, NOT A NEW ANIMATION. Every motion constant below is
 * lifted from the game's own `_spawn_floating_familiar` (webgame/scripts/main.gd)
 * so the creature on the Codex is measurably the one the player later meets in
 * the Hub: 114 px/s drift, 26 px bob over 1.7 s, 3 frames at 0.26 s, 140 px.
 * The one addition is THE NOTICE — the course change — because the game only
 * ever needed it to cross a screen, never to see someone.
 *
 * It is SILENT, matching the game's deliberate choice for the drift-by: "an
 * unexplained sound minutes after boot reads as a bug". Also correct for a
 * reading page, and browsers block autoplay anyway.
 *
 * STATE
 *   holyGiftSeen       = "1"  -> they have clocked in. Glow only. Never recruit again.
 *   soulSipLintelHeard = "1"  -> the full performance has played on this browser once.
 *                               Glow still plays; it is cheap and keeps the card warm.
 *   ?lure=replay              -> force the performance. Preview only; see README note.
 *
 * NOTHING IS EVER GATED BEHIND THIS. CLOCK IN is real HTML in soul-sips.html and
 * works with this script deleted, with JS off, and under reduced motion.
 */
(function () {
	'use strict';

	var path = (location.pathname || '/').replace(/\/+$/, '');
	var isCodex = path === '' || /\/index(\.html)?$/i.test(path);
	var isLore = /\/soul-sips(\.html)?$/i.test(path);
	if (!isCodex && !isLore) { return; }

	function flag(key) {
		try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
	}
	function raise(key) {
		try { localStorage.setItem(key, '1'); } catch (e) { /* private mode */ }
	}

	var REDUCED = window.matchMedia
		&& window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var KNOWN = flag('holyGiftSeen');                  // already works here
	var HEARD = flag('soulSipLintelHeard');            // already saw the routine
	var REPLAY = /[?&]lure=replay\b/.test(location.search);

	/* May we perform? The glow is separate and always allowed. */
	var MAY_TELL = !KNOWN && (!HEARD || REPLAY);

	/* ---- ported motion constants ------------------------------------------ */
	var SIZE = 140;          // px, the game's TextureRect size
	var SPEED = 114;         // px/s  (game: -160 -> 1440 over 14.0 s)
	var BOB_AMP = 26;        // px
	var BOB_HALF = 1.7;      // s per half cycle, sine ease-in-out
	var FRAME_MS = 260;      // 0.26 s per drift frame
	var LIFT = 34;           // px the takeoff rises out of the card
	var FRAMES = ['images/lintel-drift-1.png',
		'images/lintel-drift-2.png',
		'images/lintel-drift-3.png'];

	var LINES = [
		'Hey you…',
		'Yeah, you.',
		'You look like you’ve got bar experience…',
		'I’ve got something waiting for you.'
	];

	/* ---------------------------------------------------------------- styles */
	var css = ''
		+ '#ssd-stage{position:fixed;inset:0;pointer-events:none;z-index:8500;'
		+ 'overflow:hidden;contain:layout style;}'
		/* The glow is drawn as a soft bloom BEHIND the card's rectangle. It is not
		   a border change: a border reads as a CTA, warmth reads as a mood. */
		+ '.ssd-glow{position:absolute;border-radius:18px;opacity:0;'
		+ 'transition:opacity 1.6s ease;'
		+ 'box-shadow:0 0 34px 10px rgba(212,175,55,.30),'
		+ '0 0 90px 34px rgba(212,175,55,.14);}'
		+ '.ssd-glow.ssd-on{opacity:1;animation:ssdBreathe 4s ease-in-out infinite;}'
		+ '.ssd-glow.ssd-pulse{animation:ssdPulse .6s ease-out;}'
		+ '@keyframes ssdBreathe{0%,100%{opacity:.55}50%{opacity:1}}'
		+ '@keyframes ssdPulse{0%{transform:scale(1);opacity:1}'
		+ '45%{transform:scale(1.045);opacity:1}100%{transform:scale(1);opacity:.8}}'
		+ '.ssd-lintel{position:absolute;width:' + SIZE + 'px;height:' + SIZE + 'px;'
		+ 'opacity:0;transition:opacity .8s ease;will-change:transform;'
		+ 'filter:drop-shadow(0 6px 14px rgba(0,0,0,.34));}'
		+ '.ssd-lintel.ssd-on{opacity:1;}'
		/* Cinzel is the site's display face; the plate keeps it legible over art. */
		+ '.ssd-whisper{position:absolute;opacity:0;transform:translateY(6px);'
		+ 'transition:opacity .9s ease,transform .9s ease;'
		+ 'font-family:"Cinzel",Georgia,serif;font-size:.95rem;letter-spacing:.08em;'
		+ 'color:#f4dd9b;white-space:nowrap;padding:.5rem .9rem;border-radius:999px;'
		+ 'background:rgba(12,18,32,.82);box-shadow:0 4px 18px rgba(0,0,0,.34);}'
		+ '.ssd-whisper.ssd-on{opacity:1;transform:translateY(0);}'
		+ '@media (max-width:700px){.ssd-whisper{font-size:.82rem;'
		+ 'letter-spacing:.05em;white-space:normal;max-width:70vw;}}'
		/* ---- lore page ---- */
		+ '.ssd-hero-warm{position:relative;}'
		+ '.ssd-hero-warm::after{content:"";position:absolute;inset:-6% -3%;'
		+ 'pointer-events:none;border-radius:20px;'
		+ 'background:radial-gradient(ellipse at 50% 45%,rgba(212,175,55,.20),'
		+ 'rgba(212,175,55,0) 68%);animation:ssdHeroBreathe 6s ease-in-out infinite;}'
		+ '@keyframes ssdHeroBreathe{0%,100%{opacity:.5}50%{opacity:1}}'
		+ '.ssd-shimmer{position:relative;overflow:hidden;}'
		+ '.ssd-shimmer::before{content:"";position:absolute;top:0;bottom:0;width:38%;'
		+ 'left:-45%;pointer-events:none;z-index:2;'
		+ 'background:linear-gradient(100deg,rgba(255,255,255,0),'
		+ 'rgba(255,245,214,.30),rgba(255,255,255,0));'
		+ 'animation:ssdSheen 9s ease-in-out infinite;}'
		+ '@keyframes ssdSheen{0%{left:-45%}55%{left:115%}100%{left:115%}}'
		+ '@media (prefers-reduced-motion:reduce){'
		+ '.ssd-glow.ssd-on,.ssd-glow.ssd-pulse,.ssd-hero-warm::after,'
		+ '.ssd-shimmer::before{animation:none;}'
		+ '.ssd-lintel{display:none;}}';

	var styleTag = document.createElement('style');
	styleTag.id = 'ssd-style';
	styleTag.textContent = css;
	document.head.appendChild(styleTag);

	/* ----------------------------------------------------------------- stage */
	var stage, glow, lintel, whisper;
	function buildStage() {
		stage = document.createElement('div');
		stage.id = 'ssd-stage';
		stage.setAttribute('aria-hidden', 'true');   // atmosphere, not content

		glow = document.createElement('div');
		glow.className = 'ssd-glow';

		lintel = document.createElement('img');
		lintel.className = 'ssd-lintel';
		lintel.src = FRAMES[0];
		lintel.alt = '';
		lintel.decoding = 'async';

		whisper = document.createElement('div');
		whisper.className = 'ssd-whisper';

		stage.appendChild(glow);
		stage.appendChild(lintel);
		stage.appendChild(whisper);
		document.body.appendChild(stage);
	}

	function say(text) {
		if (!whisper) { return; }
		whisper.classList.remove('ssd-on');
		window.setTimeout(function () {
			whisper.textContent = text;
			whisper.classList.add('ssd-on');
		}, 420);
	}
	function hush() { if (whisper) { whisper.classList.remove('ssd-on'); } }

	/* Frame swap, identical cadence to the game's flap tween. */
	var flapTimer = null;
	function startFlap() {
		if (flapTimer || REDUCED) { return; }
		var i = 0;
		flapTimer = window.setInterval(function () {
			i = (i + 1) % FRAMES.length;
			lintel.src = FRAMES[i];
		}, FRAME_MS);
	}
	function stopFlap() {
		if (flapTimer) { window.clearInterval(flapTimer); flapTimer = null; }
	}

	/* ============================================================== THE CODEX */
	function runCodex() {
		var grid = document.getElementById('loreGrid');
		if (!grid) { return; }

		buildStage();

		var card = null;
		var lintelCard = null;
		var seenFor = 0;          // ms the card / section has been sufficiently visible
		var started = false;
		var lastT = 0;

		/* The grid is re-rendered by innerHTML on every filter click and every
		   search keystroke, so card elements are destroyed and replaced. Hold
		   no state on them, and re-acquire after each render. */
		function findCard() {
			return grid.querySelector('a.lore-card[href="/soul-sips"]')
				|| grid.querySelector('a.lore-card[href$="soul-sips"]');
		}
		function findLintelCard() {
			return grid.querySelector('a.lore-card[href="/lintels"]')
				|| grid.querySelector('a.lore-card[href$="lintels"]');
		}
		card = findCard();
		lintelCard = findLintelCard();
		new MutationObserver(function () {
			card = findCard();
			lintelCard = findLintelCard();
			if (!card) { glow.classList.remove('ssd-on'); }
		}).observe(grid, { childList: true, subtree: true });

		/* ---- the Lintel's flight ---- */
		var lin = {
			phase: 'idle',   // idle | takeoff | enter | notice | approach | hover | leave | gone
			x: 0, y: 0, t: 0, scale: 1,
			ax: 0, ay: 0,          // approach start
			cx: 0, cy: 0,          // Bezier control
			dur: 0,
			noticeAt: 0,
			fromCard: false,
			spawnOffset: undefined,
			liftPx: undefined
		};

		function cardRect() {
			return card ? card.getBoundingClientRect() : null;
		}
		function lintelCardRect() {
			return lintelCard ? lintelCard.getBoundingClientRect() : null;
		}

		/* Where the Lintel should hover: beside the card, outside it, clamped to
		   the viewport so it is never half off-screen on a phone. */
		/* The bob (+/- BOB_AMP) is added to this AFTER the fact, so the floor and
		   ceiling here must leave room for it. Clamping only the perch let the
		   sprite bob off the top of a narrow viewport: measured y reaching -30
		   with the card centred at 736 px wide. Clamping the composed position
		   instead would flatten the bob against the edge, which looks worse than
		   moving the perch down. */
		function clampY(y) {
			var lo = BOB_AMP + 8;
			var hi = window.innerHeight - SIZE - BOB_AMP - 8;
			if (hi < lo) { return Math.max(0, (window.innerHeight - SIZE) / 2); }
			return Math.max(lo, Math.min(hi, y));
		}

		function perch(r) {
			var narrow = window.innerWidth < 760;
			if (narrow) {
				return { x: Math.min(window.innerWidth - SIZE - 8, r.right - SIZE * 0.9),
					y: clampY(r.top - SIZE * 0.72) };
			}
			var right = r.right + 12;
			if (right + SIZE > window.innerWidth - 8) { right = r.left - SIZE - 12; }
			return { x: right, y: clampY(r.top + r.height * 0.22) };
		}

		function beginFlight() {
			var lr = lintelCardRect();
			var r = cardRect();
			var p = r ? perch(r) : { x: window.innerWidth / 2 - SIZE / 2, y: window.innerHeight * 0.5 };

			/* ALWAYS launch from the Lintels card when any of it is on screen —
			   the owner's call, and correct: emerging from its own entry is much
			   smoother than sliding in from a screen edge, and it explains where
			   the creature came from.
			   The natural spawn point is 15% down the card, but that lands off
			   screen in a one-column layout, where Lintels sits directly ABOVE
			   Soul Sips: measured y = -349 at 736 px wide, so the whole "rises out
			   of its own card" beat happened where nobody could see it. Rather
			   than give up the beat, spawn from the part of the card that IS
			   visible — clamped into the card-and-viewport overlap. It still comes
			   out of the Lintel entry; it just comes out of the bit you can see.
			   Only a card entirely off screen falls back to the edge entry. */
			var overlaps = lr && lr.bottom > 8 && lr.top < window.innerHeight - 8;
			if (overlaps) {
				var natural = lr.top + lr.height * 0.15;
				var bandTop = Math.max(lr.top, 8);
				var bandBottom = Math.min(lr.bottom - SIZE * 0.5,
					window.innerHeight - SIZE - 8);
				lin.fromCard = true;
				lin.x = lr.left + lr.width / 2 - SIZE / 2;
				lin.y = (bandBottom > bandTop)
					? Math.max(bandTop, Math.min(bandBottom, natural))
					: clampY(natural);
				/* The takeoff RISES by up to LIFT and the bob subtracts up to
				   BOB_AMP on top of that, so a spawn near the top of the screen
				   still clipped: measured minY -48 with only an 86 px sliver of
				   the card visible. Shorten the rise to whatever headroom exists
				   instead of abandoning the card spawn — a shallower lift still
				   reads as emerging, and an off-screen one reads as nothing. */
				lin.liftPx = Math.max(0, Math.min(LIFT, lin.y - (BOB_AMP + 8)));
				lin.spawnOffset = lin.y - lr.top;   // hold station on the card while it rises
				lin.scale = 0.5;
				lin.phase = 'takeoff';
				lin.t = 0;
				lintel.classList.add('ssd-on');
				startFlap();
			} else {
				/* Fallback: enter from screen edge */
				lin.fromCard = false;
				var narrow = window.innerWidth < 760;
				if (narrow) {
					lin.x = (p.x > window.innerWidth / 2) ? -SIZE : window.innerWidth + SIZE;
					lin.y = r ? Math.max(4, r.top - SIZE * 1.5) : window.innerHeight * 0.2;
				} else {
					var fromLeft = p.x > window.innerWidth / 2;
					lin.x = fromLeft ? -SIZE : window.innerWidth + SIZE;
					lin.y = r ? Math.max(8, r.top - SIZE * 0.55) : window.innerHeight * 0.3;
				}
				lin.phase = 'enter';
				lin.t = 0;
				lin.scale = 1;
				lin.noticeAt = Math.abs(p.x - lin.x) * 0.45 / SPEED;
				lintel.classList.add('ssd-on');
				startFlap();
			}
		}

		function step(dt) {
			var r = cardRect();
			var p = r ? perch(r) : { x: window.innerWidth / 2 - SIZE / 2, y: window.innerHeight * 0.5 };

			if (lin.phase === 'takeoff') {
				/* Rises out of the Lintels card illustration with a gentle expand */
				lin.t += dt;
				var k = Math.min(1, lin.t / 1.0);
				var easeOut = 1 - Math.pow(1 - k, 3);
				lin.scale = 0.5 + 0.52 * easeOut;
				var lr = lintelCardRect();
				if (lr) {
					lin.x = lr.left + lr.width / 2 - SIZE / 2;
					/* Track the spawn point chosen above, so a clamped spawn does
					   not snap back to the off-screen 15% mark on the next frame. */
					var lift = (lin.liftPx !== undefined) ? lin.liftPx : LIFT;
					lin.y = lr.top + (lin.spawnOffset !== undefined
						? lin.spawnOffset : lr.height * 0.15) - lift * easeOut;
				}
				if (lin.t >= 1.0) {
					lin.phase = 'notice';
					lin.t = 0;
					say(LINES[0]); // "Hey you…"
				}
			} else if (lin.phase === 'enter') {
				var dir = (p.x >= lin.x) ? 1 : -1;
				lin.t += dt;
				lin.x += dir * SPEED * dt;
				if (lin.t >= lin.noticeAt) {
					lin.phase = 'notice';
					lin.t = 0;
					say(LINES[0]);
				}
			} else if (lin.phase === 'notice') {
				/* THE NOTICE. A curious pause and double-take scale bounce */
				lin.t += dt;
				var k = Math.min(1, lin.t / 0.55);
				lin.scale = 1 + 0.08 * Math.sin(k * Math.PI);
				if (lin.t >= 0.7) {
					lin.phase = 'approach';
					lin.t = 0;
					lin.ax = lin.x; lin.ay = lin.y;
					var mx = (lin.ax + p.x) / 2, my = (lin.ay + p.y) / 2;
					var vx = p.x - lin.ax, vy = p.y - lin.ay;
					var len = Math.hypot(vx, vy) || 1;
					/* Arcing Bezier curve */
					lin.cx = mx + (-vy / len) * len * 0.22;
					lin.cy = my + (vx / len) * len * 0.22 - 38;
					lin.dur = Math.max(1.1, len / (SPEED * 1.15));
					lin.scale = 1;
				}
			} else if (lin.phase === 'approach') {
				lin.t += dt;
				var u = Math.min(1, lin.t / lin.dur);
				var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;  // sine-ish
				var iv = 1 - e;
				lin.x = iv * iv * lin.ax + 2 * iv * e * lin.cx + e * e * p.x;
				lin.y = iv * iv * lin.ay + 2 * iv * e * lin.cy + e * e * p.y;
				if (u >= 1) { lin.phase = 'hover'; lin.t = 0; onArrive(); }
			} else if (lin.phase === 'hover') {
				/* Follow the Soul Sips card smoothly while the user scrolls */
				lin.x += (p.x - lin.x) * Math.min(1, dt * 6);
				lin.y += (p.y - lin.y) * Math.min(1, dt * 6);
			} else if (lin.phase === 'leave') {
				lin.t += dt;
				lin.x += (lin.x < window.innerWidth / 2 ? -1 : 1) * SPEED * dt;
				lin.y -= SPEED * 0.3 * dt;
				if (lin.x < -SIZE * 2 || lin.x > window.innerWidth + SIZE * 2 || lin.y < -SIZE * 2) {
					lin.phase = 'gone';
					lintel.classList.remove('ssd-on');
					stopFlap();
				}
			}
		}

		function onArrive() {
			glow.classList.add('ssd-pulse');
			glow.classList.add('ssd-on');
			window.setTimeout(function () { glow.classList.remove('ssd-pulse'); }, 640);
			window.setTimeout(function () { say(LINES[1]); }, 1000);
			window.setTimeout(function () { say(LINES[2]); }, 4000);
			window.setTimeout(function () { say(LINES[3]); }, 7500);
			window.setTimeout(function () {
				hush();
				if (lin.phase === 'hover') { lin.phase = 'leave'; lin.t = 0; }
			}, 12500);
			raise('soulSipLintelHeard');
		}

		/* ---- the loop ---- */
		function frame(now) {
			var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
			lastT = now;
			var r = cardRect();
			var lr = lintelCardRect();

			if (r) {
				/* Glow tracks the Soul Sips card exactly. */
				glow.style.left = r.left + 'px';
				glow.style.top = r.top + 'px';
				glow.style.width = r.width + 'px';
				glow.style.height = r.height + 'px';

				var cardVisible = r.top < window.innerHeight * 0.9 && r.bottom > window.innerHeight * 0.1;
				var enough = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)
					>= r.height * 0.45;

				if (cardVisible && enough) {
					seenFor += dt * 1000;
					if (seenFor > 1000) { glow.classList.add('ssd-on'); }
				}
			} else {
				glow.classList.remove('ssd-on');
			}

			/* Check trigger for the guide performance */
			var lintelVisible = lr && lr.top < window.innerHeight * 0.85 && lr.bottom > window.innerHeight * 0.15;
			var cardVis = r && r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;

			if (!started && MAY_TELL && (lintelVisible || cardVis)) {
				started = true;
				if (!REDUCED) {
					window.setTimeout(beginFlight, 400);
				} else {
					/* Reduced motion: sequential fades directly on the card */
					window.setTimeout(function () { say(LINES[0]); }, 1000);
					window.setTimeout(function () { say(LINES[1]); }, 4000);
					window.setTimeout(function () { say(LINES[2]); }, 7000);
					window.setTimeout(function () { say(LINES[3]); }, 10000);
					window.setTimeout(hush, 15000);
					raise('soulSipLintelHeard');
				}
			}

			/* Whisper positioning */
			if (whisper) {
				if (lin.phase === 'takeoff' || lin.phase === 'notice' || (!r && lin.phase !== 'idle')) {
					var wx = Math.max(8, Math.min(window.innerWidth - whisper.offsetWidth - 8,
						lin.x + SIZE / 2 - whisper.offsetWidth / 2));
					whisper.style.left = wx + 'px';
					whisper.style.top = Math.max(6, lin.y - 42) + 'px';
				} else if (r) {
					var wx = Math.max(8, Math.min(window.innerWidth - whisper.offsetWidth - 8,
						r.left + r.width * 0.52));
					whisper.style.left = wx + 'px';
					whisper.style.top = Math.max(6, r.top - 46) + 'px';
				}
			}

			if (lin.phase !== 'idle' && lin.phase !== 'gone') {
				step(dt);
				var bob = Math.sin((now / 1000) * (Math.PI / BOB_HALF)) * BOB_AMP;
				lintel.style.transform = 'translate3d(' + lin.x + 'px,'
					+ (lin.y + bob) + 'px,0) scale(' + lin.scale + ')';
			}
			window.requestAnimationFrame(frame);
		}
		window.requestAnimationFrame(frame);
	}

	/* =========================================================== THE LORE PAGE */
	function runLore() {
		var hero = document.querySelector('.lore-hero');
		var title = document.querySelector('.lore-title');
		if (hero) { hero.classList.add('ssd-shimmer'); }
		if (title) { title.classList.add('ssd-hero-warm'); }

		if (REDUCED || KNOWN) { return; }

		/* One silent drift-by, a couple of seconds in. It does not stop and does
		   not speak: a wink for anyone who met it on the Codex, and simply a nice
		   moment for someone who arrived here from Google. */
		buildStage();
		glow.remove();
		whisper.remove();
		var x = -SIZE;
		var baseY = Math.max(80, window.innerHeight * 0.28);
		var t0 = 0;
		window.setTimeout(function () {
			lintel.classList.add('ssd-on');
			startFlap();
			window.requestAnimationFrame(function drift(now) {
				if (!t0) { t0 = now; }
				var el = (now - t0) / 1000;
				x = -SIZE + SPEED * el;
				var bob = Math.sin(el * (Math.PI / BOB_HALF)) * BOB_AMP;
				lintel.style.transform = 'translate3d(' + x + 'px,' + (baseY + bob) + 'px,0)';
				if (x > window.innerWidth + SIZE) {
					lintel.classList.remove('ssd-on');
					stopFlap();
					return;
				}
				window.requestAnimationFrame(drift);
			});
		}, 2000);
	}

	function boot() {
		if (isCodex) { runCodex(); } else { runLore(); }
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();

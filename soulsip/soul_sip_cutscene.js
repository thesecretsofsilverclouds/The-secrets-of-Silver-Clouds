/**
 * Web-only Transformative pour helper.
 * Creates an HTML <video> above the Godot canvas. Called from GDScript via
 * JavaScriptBridge (window.SoulSipCutscene.playTransformativePour).
 *
 * Callback protocol (Godot JavaScriptBridge.create_callback):
 *   callback.apply(null, ["done"])     — played to end or skipped
 *   callback.apply(null, ["failed"])   — play() rejected / error / stall / timeout
 */
(function (global) {
	"use strict";

	var ROOT_ID = "soul-sip-cutscene-root";
	var Z_INDEX = "2147483000";

	var WRAPPER_ID = "game-fullscreen-root";

	// ---- fullscreen wrapper ----------------------------------------------
	// Godot's shell calls `canvas.requestFullscreen()` directly (see
	// GodotDisplayScreen.requestFullscreen in index.js), which fullscreens the
	// <canvas>. While an element is fullscreened the browser paints only that
	// element and its descendants — and a <canvas> cannot host DOM children, so
	// the MP4 overlay was audible but never rendered.
	//
	// Rather than exiting fullscreen (which would need a fresh user gesture to
	// restore, dropping the player out after every cutscene), wrap the canvas and
	// the overlay in one container and fullscreen that instead. An own property
	// on the canvas shadows the prototype method, so Godot's own call lands on
	// the wrapper without any change to the exported shell.
	function ensureFullscreenWrapper() {
		var canvas = document.getElementById("canvas");
		if (!canvas) { return null; }
		var wrapper = document.getElementById(WRAPPER_ID);
		if (wrapper && wrapper.contains(canvas)) { return wrapper; }
		wrapper = document.createElement("div");
		wrapper.id = WRAPPER_ID;
		// Viewport units, not percentages: <body> has no definite height in the
		// Godot shell, so width/height:100% collapsed the wrapper to 0x0 and any
		// absolutely-positioned child (the cutscene overlay) collapsed with it
		// whenever the game was NOT fullscreen. In fullscreen vw/vh resolve
		// against the fullscreen viewport, so this is correct in both states.
		// 100vw/100vh are the LARGE viewport on iOS — they exclude Safari's
		// dynamic toolbars, so the wrapper ends up taller than the area actually
		// on screen. The canvas then sizes against a box bigger than the visible
		// one and every touch lands offset from the control it looks like it hit
		// (the reported symptom: having to tap low and left of a button on iPad).
		// dvw/dvh track the *visual* viewport; vw/vh stay as the fallback for
		// browsers without dynamic viewport units.
		wrapper.style.cssText = [
			"position:relative", "width:100vw", "height:100vh",
			"margin:0", "padding:0", "background:#000", "overflow:hidden",
		].join(";");
		wrapper.style.width = "100dvw";
		wrapper.style.height = "100dvh";
		if (canvas.parentNode) {
			canvas.parentNode.insertBefore(wrapper, canvas);
		}
		wrapper.appendChild(canvas);
		// Godot owns canvas position (resize policy sets it); only stack it.
		canvas.style.zIndex = "0";
		var redirect = function () { return wrapper.requestFullscreen(); };
		try {
			canvas.requestFullscreen = redirect;
			if (typeof wrapper.webkitRequestFullscreen === "function") {
				canvas.webkitRequestFullscreen = function () {
					return wrapper.webkitRequestFullscreen();
				};
			}
		} catch (e) {
			console.log("[SoulSipCutscene] could not redirect fullscreen", e);
		}
		return wrapper;
	}

	function overlayHost() {
		return ensureFullscreenWrapper() || document.body;
	}

	// Switching apps drops fullscreen, and the spec does not allow re-entering it
	// from a visibilitychange handler — Element.requestFullscreen requires an
	// active user gesture, so calling it on resume is rejected. The only correct
	// recovery is to remember that we *were* fullscreen and re-request on the very
	// next tap, which is a gesture the browser will honour.
	//
	// Deliberately one-shot and silent: it re-arms only if fullscreen is lost
	// again, and it never fires on a session the player chose to play windowed.
	var wantedFullscreen = false;
	var pendingRestore = false;

	function fullscreenElement() {
		return document.fullscreenElement || document.webkitFullscreenElement || null;
	}

	function installFullscreenRestore() {
		document.addEventListener("fullscreenchange", function () {
			// Only track deliberate entry. Loss is handled below so that an exit
			// the player asked for does not queue a surprise re-entry.
			if (fullscreenElement()) { wantedFullscreen = true; }
		}, false);

		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState === "hidden") {
				// Record the state we are about to lose. The browser drops
				// fullscreen on hide without firing anything useful afterwards.
				if (fullscreenElement()) { wantedFullscreen = true; }
				return;
			}
			if (wantedFullscreen && !fullscreenElement()) {
				pendingRestore = true;
			}
		}, false);

		var restore = function () {
			if (!pendingRestore || fullscreenElement()) { return; }
			pendingRestore = false;
			var wrapper = ensureFullscreenWrapper();
			if (!wrapper) { return; }
			var request = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
			if (typeof request !== "function") { return; }
			try {
				// May still reject (iOS Safari has no element fullscreen at all).
				// A rejection is not an error worth surfacing — the game is
				// perfectly playable windowed.
				var result = request.call(wrapper);
				if (result && typeof result.catch === "function") {
					result.catch(function () {});
				}
			} catch (e) { /* windowed is a valid outcome */ }
		};
		// Capture phase so the game canvas consuming the event cannot swallow it.
		window.addEventListener("pointerdown", restore, true);
		window.addEventListener("touchend", restore, true);
		window.addEventListener("keydown", restore, true);
	}


	// ---- fullscreen guard -------------------------------------------------
	// Godot's Web export fullscreens the <canvas> itself. While an element is
	// fullscreened the browser paints ONLY that element and its descendants, so
	// anything appended to <body> is simply not rendered — which is why the video
	// was audible but invisible, and why the on-screen diagnostic was invisible
	// too. A <canvas> cannot host DOM children, so the only fix is to leave
	// fullscreen for the cutscene.
	function fullscreenElement() {
		return document.fullscreenElement || document.webkitFullscreenElement || null;
	}

	function describeFullscreen() {
		var fe = fullscreenElement();
		if (!fe) { return "none"; }
		return fe.tagName + "#" + (fe.id || "-");
	}

	// FALLBACK ONLY — not called. Kept as a diagnostic escape hatch if the
	// wrapper redirect ever fails on a specific browser.
	function leaveFullscreenIfBlocking() {
		var fe = fullscreenElement();
		if (!fe) { return false; }
		try {
			if (document.exitFullscreen) { document.exitFullscreen(); }
			else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
			return true;
		} catch (e) {
			console.log("[SoulSipCutscene] exitFullscreen failed", e);
			return false;
		}
	}

	var START_TIMEOUT_MS = 4000;
	var STALL_TIMEOUT_MS = 3500;
	var WATCHDOG_MS = 16000;

	var active = null;

	// MUSIC HANDOFF (2026-08-16).
	//
	// A cutscene is a <video> with its own audio track. On iOS, starting it takes
	// audio focus and STOPS the music element outright — the browser does it, not
	// us. Nothing here used to hand music back afterwards, so the bar fell silent
	// for the rest of the shift after a Transformative pour and never recovered.
	// Reported as "music ended and didn't switch".
	//
	// `suspend(true)` remembers the position and pauses; `suspend(false)` resumes
	// from there, so this is a handoff rather than a restart. Guarded because the
	// music namespace is absent on a monolith build and in the editor.
	function musicSuspend(on) {
		try {
			var ns = window.__soulSipMusic;
			if (ns && typeof ns.suspend === "function") {
				ns.suspend(!!on);
			}
		} catch (err) {
			console.warn("[SoulSipCutscene] music handoff failed", err);
		}
	}

	function finish(state, reason) {
		if (!active || active.finished) {
			return;
		}
		active.finished = true;
		clearTimers(active);
		musicSuspend(false);
		var cb = active.callback;
		cleanupDom();
		active = null;
		if (typeof cb === "function") {
			try {
				cb.apply(null, [state, reason || ""]);
			} catch (err) {
				console.warn("[SoulSipCutscene] callback error", err);
			}
		}
	}

	function clearTimers(session) {
		if (!session) {
			return;
		}
		if (session.startTimer) {
			clearTimeout(session.startTimer);
			session.startTimer = null;
		}
		if (session.stallTimer) {
			clearTimeout(session.stallTimer);
			session.stallTimer = null;
		}
		if (session.watchdog) {
			clearTimeout(session.watchdog);
			session.watchdog = null;
		}
	}

	function cleanupDom() {
		var root = document.getElementById(ROOT_ID);
		if (root && root.parentNode) {
			root.parentNode.removeChild(root);
		}
	}

	function armStallWatch(session) {
		if (!session || session.finished) {
			return;
		}
		if (session.stallTimer) {
			clearTimeout(session.stallTimer);
		}
		session.stallTimer = setTimeout(function () {
			finish("failed", "stall");
		}, STALL_TIMEOUT_MS);
	}

	function playTransformativePour(url, callback) {
		cleanupDom();
		if (active) {
			clearTimers(active);
			active = null;
		}

		// Sync reject: Godot falls back to OGV immediately. Do not also fire
		// the callback or the serve would start two presentations.
		if (!url || typeof callback !== "function") {
			return false;
		}
		// Keep video on the same versioned asset origin as the engine, packs and
		// loose music. Absolute URLs remain absolute; relative media/ URLs are
		// resolved by the launch shell's single asset-base contract.
		if (typeof global.__soulSipResolveAsset === "function") {
			url = global.__soulSipResolveAsset(url);
		}

		var root = document.createElement("div");
		root.id = ROOT_ID;
		root.setAttribute("aria-hidden", "true");
		// Explicit top/left + viewport units rather than `inset:0` and
		// percentages: a percentage height only resolves if every ancestor has a
		// definite height, and on mobile that is how a <video> ends up audible
		// with a zero-height box. Also no opacity gate — the overlay is opaque
		// from creation, so the picture can never be stuck behind a fade that
		// never ran.
		root.style.cssText = [
			"position:absolute",
			"inset:0",
			"z-index:100",
			"background:#000",
			"display:flex",
			"align-items:center",
			"justify-content:center",
			"opacity:1",
			"visibility:visible",
			"pointer-events:none",
		].join(";");

		var video = document.createElement("video");
		video.setAttribute("playsinline", "");
		video.setAttribute("webkit-playsinline", "");
		video.playsInline = true;
		video.controls = false;
		video.loop = false;
		video.preload = "auto";
		video.disablePictureInPicture = true;
		video.setAttribute("disablepictureinpicture", "");
		video.style.cssText = [
			"width:100%",
			"height:100%",
			"object-fit:contain",
			"background:#000",
			"opacity:1",
			"visibility:visible",
			"display:block",
			"pointer-events:none",
		].join(";");
		video.src = url;

		// Video itself ignores pointers (spec). Skip lives in HTML so it stays
		// above the canvas and remains tappable.
		var skip = document.createElement("button");
		skip.type = "button";
		skip.textContent = "tap to skip";
		skip.style.cssText = [
			"position:fixed",
			"right:18px",
			"bottom:16px",
			"z-index:" + (parseInt(Z_INDEX, 10) + 1),
			"pointer-events:auto",
			"border:0",
			"background:rgba(8,6,14,0.55)",
			"color:rgba(230,220,245,0.9)",
			"font:600 13px/1.2 system-ui,sans-serif",
			"letter-spacing:0.04em",
			"padding:10px 14px",
			"border-radius:8px",
			"cursor:pointer",
		].join(";");

		root.appendChild(video);
		root.appendChild(skip);
		overlayHost().appendChild(root);

		var session = {
			callback: callback,
			finished: false,
			started: false,
			startTimer: null,
			stallTimer: null,
			watchdog: null,
			video: video,
			root: root,
		};
		active = session;

		// The overlay is already opaque; this only re-asserts it in case some
		// other code path dimmed it. Kept so existing call sites are unchanged.
		function reveal() {
			root.style.opacity = "1";
			root.style.visibility = "visible";
		}

		function tryPlay() {
			if (session.finished || session.started) {
				return;
			}
			var playResult;
			// Register with the flight recorder before playing. The cutscene
			// element IS in the DOM, but the recorder's observer only matched
			// AUDIO tags, so a <video> holding audio focus was never logged --
			// and taking that focus is precisely what stops the music on iOS.
			try {
				if (window.__soulSipBBWatchMedia) {
					window.__soulSipBBWatchMedia(video, "cutscene", true);
				}
			} catch (err) {}
			musicSuspend(true);
			try {
				playResult = video.play();
			} catch (err) {
				finish("failed", "play_throw");
				return;
			}
			if (playResult && typeof playResult.then === "function") {
				playResult.then(function () {
					if (session.finished) {
						return;
					}
					session.started = true;
					if (session.startTimer) {
						clearTimeout(session.startTimer);
						session.startTimer = null;
					}
					reveal();
					armStallWatch(session);
				}).catch(function (err) {
					console.warn("[SoulSipCutscene] play() rejected", err);
					finish("failed", "play_rejected");
				});
			} else {
				session.started = true;
				if (session.startTimer) {
					clearTimeout(session.startTimer);
					session.startTimer = null;
				}
				reveal();
				armStallWatch(session);
			}
		}

		skip.addEventListener("click", function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				video.pause();
			} catch (_e) {}
			finish("done", "skipped");
		});

		video.addEventListener("playing", function () {
			if (session.finished) {
				return;
			}
			session.started = true;
			if (session.startTimer) {
				clearTimeout(session.startTimer);
				session.startTimer = null;
			}
			reveal();
			armStallWatch(session);
		});
		video.addEventListener("timeupdate", function () {
			if (!session.finished && session.started) {
				armStallWatch(session);
			}
		});
		video.addEventListener("waiting", function () {
			armStallWatch(session);
		});
		video.addEventListener("ended", function () {
			finish("done", "ended");
		});
		video.addEventListener("error", function () {
			finish("failed", "error");
		});

		session.startTimer = setTimeout(function () {
			if (!session.started) {
				finish("failed", "start_timeout");
			}
		}, START_TIMEOUT_MS);
		session.watchdog = setTimeout(function () {
			finish(session.started ? "done" : "failed", "watchdog");
		}, WATCHDOG_MS);

		if (video.readyState >= 2) {
			tryPlay();
		} else {
			video.addEventListener("loadeddata", tryPlay, { once: true });
			video.addEventListener("canplay", tryPlay, { once: true });
			try {
				video.load();
			} catch (_e) {}
		}
		return true;
	}

	function abort() {
		if (!active) {
			cleanupDom();
			return;
		}
		finish("done", "abort");
	}

	global.SoulSipCutscene = {
		playCutscene: playTransformativePour,
		playTransformativePour: playTransformativePour,
		abort: abort,
		ensureFullscreenWrapper: ensureFullscreenWrapper,
	};

	// Install the wrapper as soon as the canvas exists — before the player can
	// reach the fullscreen button. If Godot fullscreens the bare canvas first,
	// the redirect never gets a chance and the overlay is unpaintable again.
	// The canvas is created by index.js, which may not have run yet.
	(function installWrapper(attempt) {
		if (ensureFullscreenWrapper()) {
			installFullscreenRestore();
			return;
		}
		if (attempt > 100) {
			console.log("[SoulSipCutscene] canvas never appeared; wrapper not installed");
			return;
		}
		setTimeout(function () { installWrapper(attempt + 1); }, 100);
	})(0);
})(typeof window !== "undefined" ? window : globalThis);

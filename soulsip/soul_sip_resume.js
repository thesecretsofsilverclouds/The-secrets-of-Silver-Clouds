// Soul Sip - mobile resume guard.
//
// Symptom this exists for: on a phone, leaving the game idle can leave the
// canvas showing a perfectly intact final frame while nothing advances. That is
// not an out-of-memory abort -- a WebAssembly OOM tears the runtime down and
// leaves a blank canvas. A frame that survives means the page is alive and the
// renderer is not: the browser reclaimed the WebGL context, which mobile
// browsers do aggressively for backgrounded tabs and under memory pressure.
//
// Godot 4 (GL Compatibility) cannot rebuild its GPU resources after a lost
// context, so recovery in-place is not on the table. What we can do is notice
// it, say so plainly, and offer a reload -- progress lives in IndexedDB, so a
// reload resumes from the last save rather than losing the session.
(function () {
	"use strict";

	var OVERLAY_ID = "soul-sip-resume-overlay";
	var contextLost = false;
	var contextLostCount = 0;
	var contextRestoredCount = 0;
	var lastContextEvent = "none";

	function canvas() {
		return document.getElementById("canvas") || document.querySelector("canvas");
	}

	// Polled by the opt-in device probe. No timer or network work lives here.
	window.__soulSipGraphicsState = function () {
		var element = canvas();
		var rect = element ? element.getBoundingClientRect() : null;
		return {
			canvas_width: element ? element.width : -1,
			canvas_height: element ? element.height : -1,
			css_width: rect ? Math.round(rect.width) : -1,
			css_height: rect ? Math.round(rect.height) : -1,
			device_pixel_ratio: window.devicePixelRatio || 1,
			context_lost: contextLost,
			context_lost_count: contextLostCount,
			context_restored_count: contextRestoredCount,
			last_context_event: lastContextEvent
		};
	};

	// Prefer the fullscreen wrapper when the cutscene helper has built one:
	// while fullscreen is active the browser paints only that element and its
	// descendants, so an overlay parented anywhere else is invisible.
	function overlayHost() {
		return document.getElementById("game-fullscreen-root") || document.body;
	}

	function showOverlay(title, detail) {
		if (document.getElementById(OVERLAY_ID)) {
			return;
		}
		var root = document.createElement("div");
		root.id = OVERLAY_ID;
		root.setAttribute("role", "alertdialog");
		root.style.cssText = [
			"position:absolute", "inset:0", "z-index:200",
			"display:flex", "flex-direction:column",
			"align-items:center", "justify-content:center",
			"gap:18px", "padding:24px", "box-sizing:border-box",
			"background:rgba(6,4,16,0.94)", "text-align:center",
			"font-family:system-ui,-apple-system,sans-serif", "color:#f2e6c8"
		].join(";");

		var heading = document.createElement("div");
		heading.textContent = title;
		heading.style.cssText = "font-size:20px;font-weight:600;letter-spacing:0.02em";

		var body = document.createElement("div");
		body.textContent = detail;
		body.style.cssText = "font-size:15px;line-height:1.5;max-width:32em;opacity:0.85";

		var button = document.createElement("button");
		button.type = "button";
		button.textContent = "Resume";
		button.style.cssText = [
			"margin-top:6px", "padding:14px 34px", "font-size:17px",
			"border-radius:10px", "border:1px solid #c9a94a",
			"background:#c9a94a", "color:#1a1207", "font-weight:600",
			"cursor:pointer", "touch-action:manipulation"
		].join(";");
		button.addEventListener("click", function () {
			button.disabled = true;
			button.textContent = "Resuming…";
			// Same URL, build tag intact: the reload comes from cache and the
			// save is read back out of IndexedDB.
			window.location.reload();
		});

		root.appendChild(heading);
		root.appendChild(body);
		root.appendChild(button);
		overlayHost().appendChild(root);
	}

	function install() {
		var element = canvas();
		if (!element) {
			return false;
		}
		element.addEventListener("webglcontextlost", function (event) {
			// Without preventDefault the browser will not even attempt a restore,
			// and we lose the chance to report it cleanly.
			event.preventDefault();
			contextLost = true;
			contextLostCount += 1;
			lastContextEvent = "lost";
			console.warn("[SoulSipResume] WebGL context lost - offering reload");
			showOverlay(
				"The browser paused the game",
				"Your phone released the game's graphics while it sat idle. " +
				"Progress is saved - resuming reloads from your last save."
			);
		}, false);

		element.addEventListener("webglcontextrestored", function () {
			contextRestoredCount += 1;
			lastContextEvent = "restored";
			// The context can come back, but Godot's GL state and every uploaded
			// texture did not: rendering into it would draw nothing. A reload is
			// still the only real recovery, so the overlay stays put.
			console.warn("[SoulSipResume] WebGL context restored - reload still required");
		}, false);

		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState === "visible" && contextLost) {
				showOverlay(
					"The browser paused the game",
					"Your phone released the game's graphics while it sat idle. " +
					"Progress is saved - resuming reloads from your last save."
				);
			}
		}, false);

		console.log("[SoulSipResume] armed");
		return true;
	}

	if (!install()) {
		// The canvas is created by the Godot shell, which may not have run yet.
		var attempts = 0;
		var timer = setInterval(function () {
			attempts += 1;
			if (install() || attempts > 100) {
				clearInterval(timer);
			}
		}, 100);
	}
})();

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openStartupWorld } from './src/startup-world.mjs';
import { openSocialStore } from './src/social-store.mjs';
import { detectWagerForEvent } from './src/wagers.mjs';
import {
  getLatestDispatch,
  getDispatchByDate,
} from './src/dispatch.mjs';
import { evaluatePlotClocks } from './src/clocks.mjs';
import { openCinematicStore } from './src/cinematic-store.mjs';
import { CinematicService, ViewerRegistry } from './src/cinematic-service.mjs';
import { cinematicConfig, openAICinematicClient } from './src/cinematics.mjs';
import { editorialCinematicRecordForApi } from './src/editorial-cinematics.mjs';
import { historyOptions } from './src/public-history.mjs';
import { AMBIENT_ASSETS, isAmbientAudioFile, publicAmbientSources } from './src/ambient-assets.mjs';
import { TRACKS } from './cloudflare/src/media-manifest.mjs';
import { buildStoryThread, listStoryThreads } from './src/story-threads.mjs';
import { openFeedbackStore, FeedbackError, MAX_FEEDBACK_BODY_BYTES } from './src/feedback-store.mjs';
import { openAudienceStore } from './src/audience-store.mjs';
import { BACKGROUND_BY_ID, selectVisualVocabulary } from './src/cinematic-assets.mjs';
import { daypart } from './src/sky.mjs';
import { createSceneReservoirRuntime } from './src/scene-reservoir-runtime.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
// The reader app now lives in the website itself — `worldstream/app/` — because
// that is what a static host serves. This workshop server still serves it for
// the single-origin development path; the deployed shape is the static site
// calling the Cloudflare backend instead.
const appDirectory = join(directory, '..', 'worldstream', 'app');
const BIND_ADDRESS = '127.0.0.1';
const PORT = 4317;


function localHost(request) {
  const host = request.headers.host;
  const port = request.socket.localPort;
  return typeof host === 'string'
    && (host === `127.0.0.1:${port}` || host === `localhost:${port}`);
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== `http://${request.headers.host}`) return false;
  return request.headers['sec-fetch-site'] !== 'cross-site';
}

function send(response, status, contentType, body, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    // img-src covers the three lintel drift frames; everything else stays denied.
    // media-src covers the score. Without it `default-src 'none'` blocks every
    // <audio> fetch and the music layer fails silently, which is exactly how it
    // would fail in production too.
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    ...extraHeaders,
  });
  response.end(body);
}

function sendJson(response, status, value, extraHeaders) {
  send(response, status, 'application/json; charset=utf-8', JSON.stringify(value), extraHeaders);
}

function readJsonBody(request, maxBytes = 16_384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        request.resume();
        reject(new Error('BODY_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          reject(new Error('INVALID_JSON'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    request.on('error', reject);
  });
}

function findEvent(world, eventId) {
  try {
    if (typeof world.eventById === 'function') {
      const event = world.eventById(eventId);
      return event?.visibility === 'public' ? event : {id:eventId};
    }
    if (typeof world.publicProjection === 'function') {
      const proj = world.publicProjection();
      if (Array.isArray(proj?.events)) {
        const found = proj.events.find((e) => e.id === eventId);
        if (found) return found;
      }
    }
    // Indexed single-row lookup. This used to fall through to
    // semanticSnapshot(), which loads every event the world has ever recorded —
    // a request for one old event id pulled the entire ledger into memory, and
    // that ledger is measured in hundreds of megabytes within two months.
    if (typeof world.eventById === 'function') {
      const found = world.eventById(eventId);
      if (found) return found;
    }
  } catch {}
  return { id: eventId };
}

// One server owns one WorldStore and one SocialStore. Clients cannot select a database or world time.
// Read and observe deliberately remain separate operations.
export function createApp({ world, socialStore, feedbackStore, audienceStore, cinematicStore, cinematicService,
  cinematicClient, cinematicOptions, viewerRegistry, now = Date.now }) {
  if (!world || typeof world.advance !== 'function' || typeof world.publicProjection !== 'function') {
    throw new TypeError('createApp requires a world store');
  }
  const dialogueSourcesForEvent = event => world.publicDialogueSources?.(event)
    ?? world.presentationSnapshot?.()?.events ?? [];
  const store = socialStore || openSocialStore({ dbPath: ':memory:' });
  const feedback = feedbackStore || openFeedbackStore({ dbPath: ':memory:', now });
  const ownsCinematicStore = !cinematicStore && !cinematicService;
  const sceneStore = cinematicStore || (cinematicService ? null : openCinematicStore({ dbPath: ':memory:' }));
  const sceneConfig = cinematicOptions || cinematicConfig();
  const sceneClient = cinematicClient !== undefined ? cinematicClient
    : sceneConfig.enabled ? openAICinematicClient({
      apiKey: process.env.OPENAI_API_KEY, model: sceneConfig.model,
      timeoutMs: sceneConfig.timeoutMs, maxOutputTokens: sceneConfig.maxOutputTokens,
    }) : null;
  const viewers = viewerRegistry || new ViewerRegistry({
    ttlMs: sceneConfig.activeViewerTtlMs, reconnectGraceMs: sceneConfig.reconnectGraceMs,
  });
  // Operational telemetry is never part of the canonical world or a public API.
  // Counts mean recently active browser sessions, not unique human beings.
  const audience = audienceStore || openAudienceStore({ dbPath: ':memory:', ttlMs: viewers.ttlMs });
  audience.beginRun(now());
  const cinematics = cinematicService || new CinematicService({
    store: sceneStore, client: sceneClient, config: sceneConfig, now,
    getPresence: at => viewers.snapshot(at),
  });
  const sceneReservoir = (world.db && typeof world.db.exec === 'function' && typeof world.db.prepare === 'function')
    ? createSceneReservoirRuntime({ db: world.db, env: process.env }) : null;
  const sessions = new Map();
  function heartbeat(request, at) {
    for (const [id, lastSeen] of sessions) if (at - lastSeen > 86_400_000) sessions.delete(id);
    const supplied = request.headers['x-viewer-token'];
    const token = typeof supplied === 'string' && sessions.has(supplied) ? supplied : randomUUID();
    sessions.set(token, at);
    viewers.touch(token, at);
    audience.heartbeat(token, at);
    return token;
  }
  function publicWorld() {
    const projection = world.publicProjection();
    const storyThreads = typeof world.presentationSnapshot === 'function' ? listStoryThreads(world.presentationSnapshot()) : [];
    const cache = cinematicStore || cinematics.store;
    const snap = typeof world.presentationSnapshot === 'function' ? world.presentationSnapshot() : null;
    return { ...projection, storyThreads, events: (projection.events ?? []).map(event => {
      const row = cache?.get(event.id);
      const visuals = selectVisualVocabulary({ event, daypart: daypart(event.occurredAt), room: event.area });
      const backgroundUrl = BACKGROUND_BY_ID[visuals.backgrounds[0]]?.file;
      return { ...event, backgroundUrl,
        ...(row?.scene && ['performed', 'fallback'].includes(row.status) ? { cinematic: editorialCinematicRecordForApi(row,
          { event: world.eventById?.(row.eventId), snapshot: snap, publicSourcesForEvent: dialogueSourcesForEvent }) } : {}) };
    }) };
  }

  function runSceneReservoirMaintenance(atMs) {
    if (!sceneReservoir) return;
    try {
      const snapshot = world.presentationSnapshot?.() ?? world.semanticSnapshot?.();
      const result = sceneReservoir.tick(snapshot, atMs);
      result?.generation?.catch(() => {});
    } catch {}
  }

  function getClientOrigin(req) {
    const host = req.headers.host;
    if (typeof host === 'string' && host) {
      return `http://${host}`;
    }
    return 'http://127.0.0.1:4317';
  }

  const assets = new Map([
    ['/', { type: 'text/html; charset=utf-8', bytes: readFileSync(join(appDirectory, 'index.html')) }],
    ['/style.css', { type: 'text/css; charset=utf-8', bytes: readFileSync(join(appDirectory, 'style.css')) }],
    ['/app.js', { type: 'text/javascript; charset=utf-8', bytes: readFileSync(join(appDirectory, 'app.js')) }],
    ['/cinematic-player.js', { type: 'text/javascript; charset=utf-8', bytes: readFileSync(join(appDirectory, 'cinematic-player.js')) }],
  ]);
  assets.set('/index.html', assets.get('/'));
  for (const file of ['weather-layer.js', 'ambient-audio.js', 'road-sprites.js', 'atmosphere.js', 'score-mood.js', 'score-rotation.js', 'atmosphere-preview.js',
    'api-base.js', 'reading-view.js', 'reading-recap.js', 'reading-history.js', 'reader-scene.js',
    'reader-narrative.js', 'story-trails.js', 'reader-feedback.js']) {
    assets.set(`/${file}`, { type: 'text/javascript; charset=utf-8', bytes: readFileSync(join(appDirectory, file)) });
  }
  for (const file of ['reading-view.css', 'scene-reading.css', 'reader-feedback.css']) {
    assets.set(`/${file}`, { type: 'text/css; charset=utf-8', bytes: readFileSync(join(appDirectory, file)) });
  }
  assets.set('/atmosphere-preview', { type: 'text/html; charset=utf-8', bytes: readFileSync(join(appDirectory, 'atmosphere-preview.html')) });
  // Processed, reviewed art only. These exact URL entries never resolve paths from requests.
  const ambientVisualFiles = ['road-sprites.json', ...['orange', 'shades'].flatMap(id =>
    [`road-sprite-${id}-run-strip.webp`, `road-sprite-${id}-still.webp`, `road-sprite-${id}-sleep.webp`])];
  for (const file of ambientVisualFiles) {
    if (!existsSync(join(appDirectory, 'ambient', file))) continue;
    const type = file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png'
      : file === 'road-sprites.json' ? 'application/json; charset=utf-8' : null;
    if (type) assets.set(`/ambient/${file}`, { type, bytes: readFileSync(join(appDirectory, 'ambient', file)) });
  }
  // The lintel drift frames, read once at startup like every other asset. The
  // path list is fixed here; no filesystem path is ever derived from a URL.
  for (const frame of ['lintel-drift-1.png', 'lintel-drift-2.png', 'lintel-drift-3.png']) {
    assets.set(`/${frame}`, { type: 'image/png', bytes: readFileSync(join(appDirectory, frame)) });
  }
  // Conversation plates and backdrops. Enumerated from the directory once at
  // startup and then served only by exact match from this map, so the URL still
  // never reaches the filesystem. The browser fetches a plate the first time a
  // scene needs it rather than on page load.
  for (const file of readdirSync(join(appDirectory, 'scene'))) {
    const type = file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : null;
    if (!type) continue;
    assets.set(`/scene/${file}`, { type, bytes: readFileSync(join(appDirectory, 'scene', file)) });
  }
  // The score. Read out of Assets/ rather than copied into public/, because
  // fifteen megabytes of audio duplicated on disk to satisfy a directory
  // convention is a worse trade than one more enumeration. The URL is a slug
  // rather than the filename — the tracks have spaces in their names and a
  // percent-encoded URL is a needless way to get this wrong — and as everywhere
  // else the map is built once and matched exactly, so no URL reaches the disk.
  // Audio lives in the app, once. `worldstream/app/audio/` is what the static
  // site serves and what a Cloudflare deployment will hand to readers; keeping
  // a second copy beside the server meant fifty-five megabytes of the same
  // eighteen files in one repository, and two places for them to disagree.
  //
  // Files are named by slug because that is the URL the page requests. Titles
  // come from the generated manifest, because a slug does not round-trip back
  // into a title — "legends-of-dawn" is *Legends of Dawn*, not *Legends Of
  // Dawn*. A track dropped in without a manifest entry still plays, listed
  // under its slug until somebody gives it a better name.
  const tracks = new Map();
  const ambientDirectory = join(appDirectory, 'ambient');
  const ambientPresent = [];
  for (const { file, url } of Object.values(AMBIENT_ASSETS)) {
    const path = join(ambientDirectory, url.split('/').pop());
    if (!existsSync(path)) continue;
    ambientPresent.push(file);
    assets.set(url, { type: 'audio/mpeg', bytes: readFileSync(path), media: true });
  }
  const audioDirectory = join(appDirectory, 'audio');
  const trackTitles = new Map(TRACKS.map((track) => [track.slug, track.title]));
  for (const file of existsSync(audioDirectory) ? readdirSync(audioDirectory) : []) {
    if (!file.toLowerCase().endsWith('.mp3') || isAmbientAudioFile(file)) continue;
    const slug = file.replace(/\.mp3$/i, '');
    tracks.set(slug, { title: trackTitles.get(slug) ?? slug, bytes: readFileSync(join(audioDirectory, file)) });
    assets.set(`/audio/${slug}.mp3`, { type: 'audio/mpeg', bytes: tracks.get(slug).bytes, media: true });
  }
  // The reader app is mounted at /worldstream/app/ on the website, so its
  // markup asks for /worldstream/app/scene/... . This server hands the same
  // files back from the site root, and both have to answer, or the app works
  // in one local mode and not the other. Aliases rather than a second copy.
  const APP_MOUNT = '/worldstream/app';
  for (const [url, asset] of [...assets]) {
    if (url === '/') { assets.set(`${APP_MOUNT}/`, asset); continue; }
    assets.set(`${APP_MOUNT}${url}`, asset);
  }

  const trackList = [...tracks].map(([slug, track]) => ({ slug, title: track.title, seconds: null }));

  const server = createServer(async (request, response) => {
    if (!localHost(request) || !sameOrigin(request)) {
      request.resume();
      sendJson(response, 403, { error: 'This service is available from its local page only.' });
      return;
    }

    const [pathname, search] = (request.url || '').split('?');
    const queryParams = new URLSearchParams(search || '');
    const travellerId = queryParams.get('travellerId');
    const eventMatch = pathname ? pathname.match(/^\/api\/events\/([^/?#]+)\/(social|react|comment|wager(?:\/vote)?)$/) : null;

    // Reject framing up front for endpoints that do not accept request bodies
    const noBodyEndpoints = (!eventMatch || eventMatch[2] === 'social' || eventMatch[2] === 'wager')
      && pathname !== '/api/presence/ping' && pathname !== '/api/presence/leave'
      && !(pathname === '/api/feedback' && request.method === 'POST');
    if (noBodyEndpoints) {
      if (request.headers['transfer-encoding'] !== undefined
        || (request.headers['content-length'] !== undefined && request.headers['content-length'] !== '0')) {
        request.resume();
        sendJson(response, 400, { error: 'Request bodies are not accepted.' }, { Connection: 'close' });
        return;
      }
    }

    try {
      if (pathname === '/api/feedback') {
        if (queryParams.size) { sendJson(response, 400, { error: 'The poll does not accept query parameters.' }); return; }
        if (request.method === 'GET') { sendJson(response, 200, feedback.summary()); return; }
        if (request.method !== 'POST') { sendJson(response, 405, { error: 'Use GET or POST for this endpoint.' }, { Allow: 'GET, POST' }); return; }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
          request.resume(); sendJson(response, 415, { error: 'Send feedback as JSON.' }); return;
        }
        try {
          const ballot = await readJsonBody(request, MAX_FEEDBACK_BODY_BYTES);
          sendJson(response, 200, feedback.vote(ballot));
        } catch (error) {
          if (error instanceof FeedbackError) {
            sendJson(response, error.status, { error: error.message }, error.retryAfterMs
              ? { 'Retry-After': String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))) } : {});
          } else sendJson(response, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: 'Invalid feedback request.' });
        }
        return;
      }
      if (request.url === '/api/world') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        const serverTime = now();
        const clocks = evaluatePlotClocks(world, serverTime);
        sendJson(response, 200, { ...publicWorld(), clocks, serverTime });
        return;
      }

      if (pathname === '/api/history' && typeof world.publicHistory === 'function') {
        if(request.method!=='GET') {sendJson(response,405,{error:'Use GET for this endpoint.'});return;}
        try { sendJson(response,200,world.publicHistory(historyOptions(queryParams))); }
        catch (error) {
          if (error instanceof RangeError) sendJson(response,400,{error:error.message});
          else throw error;
        }
        return;
      }

      const contextMatch = pathname.match(/^\/api\/events\/([^/]+)\/context$/);
      if (contextMatch && typeof world.publicEventContext === 'function') {
        if(request.method!=='GET') {sendJson(response,405,{error:'Use GET for this endpoint.'});return;}
        let eventId;
        try { eventId = decodeURIComponent(contextMatch[1]); }
        catch { sendJson(response,400,{error:'Invalid event reference.'});return; }
        const context = world.publicEventContext(eventId);
        sendJson(response,context ? 200 : 404,context ?? {error:'Public passage not found.'});return;
      }

      if (pathname === '/api/story-thread') {
        if (request.method !== 'GET') { sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' }); return; }
        const type = queryParams.get('type'), id = queryParams.get('id');
        if (queryParams.size !== 2 || !['story', 'intention', 'operation'].includes(type)
          || typeof id !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(id)) {
          sendJson(response, 400, { error: 'Invalid story reference.' }); return;
        }
        const snapshot = world.presentationSnapshot?.();
        const thread = snapshot ? buildStoryThread(snapshot, { type, id }, { eventById: eventId => world.eventById?.(eventId) }) : null;
        if (!thread) { sendJson(response, 404, { error: 'Public story not found.' }); return; }
        sendJson(response, 200, thread); return;
      }

      if (request.url === '/api/observe') {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use POST for this endpoint.' }, { Allow: 'POST' });
          return;
        }
        const serverTime = now();
        world.advance(serverTime);
        try {
          store.syncWagers(world, serverTime);
        } catch {}
        try {
          const live = viewers.snapshot(serverTime);
          const indexed = cinematics.ingest(world.presentationSnapshot?.() ?? world.semanticSnapshot(), {
            presence: live, now: serverTime,
          });
          // Model latency never holds the canonical observe request open. All
          // current viewers consume the one cached result through /live.
          indexed.generation?.catch(() => {});
        } catch {}
        const clocks = evaluatePlotClocks(world, serverTime);
        sendJson(response, 200, { ...publicWorld(), clocks, serverTime });
        return;
      }

      if (pathname === '/api/clocks') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        const serverTime = now();
        const clocks = evaluatePlotClocks(world, serverTime);
        sendJson(response, 200, { clocks, serverTime });
        return;
      }

      if (pathname === '/api/presence/leave') {
        if (request.method !== 'POST') { sendJson(response, 405, { error: 'Use POST for this endpoint.' }); return; }
        let body;
        try { body = await readJsonBody(request); }
        catch (error) { sendJson(response, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: 'Invalid presence request.' }); return; }
        const token = request.headers['x-viewer-token'] || body.viewerToken;
        if (typeof token === 'string' && sessions.has(token)) {
          viewers.disconnect(token);
          audience.leave(token, now());
        }
        sendJson(response, 200, { ok: true });
        return;
      }

      if (pathname === '/api/presence' || pathname === '/api/presence/ping') {
        if (request.method !== 'GET' && request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use GET or POST for this endpoint.' }, { Allow: 'GET, POST' });
          return;
        }
        if (request.method === 'POST') {
          try { await readJsonBody(request); }
          catch (error) { sendJson(response, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: 'Invalid presence request.' }); return; }
        }
        const serverTime = now();
        const viewerToken = request.method === 'POST' ? heartbeat(request, serverTime) : null;
        sendJson(response, 200, { ok: true, ...(viewerToken ? { viewerToken } : {}), serverTime });
        return;
      }

      const cinematicEvent = pathname.match(/^\/api\/cinematics\/events\/([^/?#]+)$/);
      if (pathname === '/api/cinematics/archive' || cinematicEvent) {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        const cache = cinematicStore || cinematics.store;
        const snap = typeof world.presentationSnapshot === 'function' ? world.presentationSnapshot() : null;
        if (cinematicEvent) {
          const row = cache?.get(decodeURIComponent(cinematicEvent[1]));
          if (!row?.scene || !['performed', 'fallback'].includes(row.status)) { sendJson(response, 404, { error: 'Not found.' }); return; }
          const event = world.eventById?.(row.eventId) ?? snap?.events?.find(e => e.id === row.eventId) ?? null;
          sendJson(response, 200, { cinematic: editorialCinematicRecordForApi(row,
            { event, snapshot: snap, publicSourcesForEvent: dialogueSourcesForEvent }), serverTime: now() });
        } else {
          const rows = (cache?.list() ?? []).filter(row => row.scene && ['performed', 'fallback'].includes(row.status))
            .sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 30);
          sendJson(response, 200, { cinematics: rows.map(row => {
            const event = world.eventById?.(row.eventId) ?? snap?.events?.find(e => e.id === row.eventId) ?? null;
            return editorialCinematicRecordForApi(row, { event, snapshot: snap, publicSourcesForEvent: dialogueSourcesForEvent });
          }), serverTime: now() });
        }
        return;
      }

      if (pathname === '/api/cinematics/live') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        const serverTime = now();
        const after = Number(queryParams.get('after') || 0);
        const safeAfter = Number.isSafeInteger(after) && after >= 0 ? after : 0;
        sendJson(response, 200, {
          cinematic: cinematics.nextPresentation({ afterAcceptedAt: safeAfter, now: serverTime,
            eventById: id => world.eventById?.(id), publicSourcesForEvent: dialogueSourcesForEvent }),
          serverTime,
        });
        return;
      }

      if (pathname === '/api/cinematics/status') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        const serverTime = now();
        sendJson(response, 200, { ...cinematics.status(serverTime), serverTime });
        return;
      }

      if (pathname === '/api/dispatch/latest') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        const serverTime = now();
        const origin = getClientOrigin(request);
        const dispatch = getLatestDispatch(world, serverTime, origin);
        sendJson(response, 200, dispatch);
        return;
      }

      const dispatchMatch = pathname ? pathname.match(/^\/api\/dispatch\/([^/?#]+)$/) : null;
      if (dispatchMatch) {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        let dateStr;
        try {
          dateStr = decodeURIComponent(dispatchMatch[1]);
        } catch {
          sendJson(response, 400, { error: 'Invalid date encoding.' });
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          sendJson(response, 400, { error: 'Invalid date format. Expected YYYY-MM-DD.' });
          return;
        }
        const serverTime = now();
        const origin = getClientOrigin(request);
        const dispatch = getDispatchByDate(world, dateStr, serverTime, origin);
        sendJson(response, 200, dispatch);
        return;
      }

      if (pathname === '/api/highlights/today') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        let events = [];
        try {
          const proj = world.publicProjection();
          events = proj?.events || [];
        } catch {}
        const highlight = store.getTodayHighlight(events, null, now());
        sendJson(response, 200, highlight);
        return;
      }

      const travellerMatch = pathname ? pathname.match(/^\/api\/travellers\/([^/?#]+)\/accolades$/) : null;
      if (travellerMatch) {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
          return;
        }
        let tId;
        try {
          tId = decodeURIComponent(travellerMatch[1]);
        } catch {
          sendJson(response, 400, { error: 'Invalid traveller ID encoding.' });
          return;
        }
        const accolades = store.getAccolades(tId);
        sendJson(response, 200, { travellerId: tId, accolades });
        return;
      }

      if (eventMatch) {
        let eventId;
        try {
          eventId = decodeURIComponent(eventMatch[1]);
        } catch {
          sendJson(response, 400, { error: 'Invalid event ID encoding.' });
          return;
        }
        const action = eventMatch[2];
        const event = findEvent(world, eventId);

        if (action === 'social') {
          if (request.method !== 'GET') {
            sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
            return;
          }
          const social = store.getSocial(eventId, event, now());
          sendJson(response, 200, social);
          return;
        }

        if (action === 'wager') {
          if (request.method !== 'GET') {
            sendJson(response, 405, { error: 'Use GET for this endpoint.' }, { Allow: 'GET' });
            return;
          }
          const serverTime = now();
          let wager = store.getWagerByEventId(eventId, travellerId, serverTime);
          if (!wager) {
            let snapshot = null;
            try {
              if (typeof world.semanticSnapshot === 'function') snapshot = world.presentationSnapshot?.() ?? world.semanticSnapshot();
            } catch {}
            const detected = detectWagerForEvent(event, snapshot, serverTime);
            if (detected) {
              store.createWager(detected, serverTime);
              wager = store.getWagerByEventId(eventId, travellerId, serverTime);
            }
          }
          sendJson(response, 200, { wager });
          return;
        }

        if (action === 'wager/vote') {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Use POST for this endpoint.' }, { Allow: 'POST' });
            return;
          }
          let body;
          try {
            body = await readJsonBody(request);
          } catch (err) {
            const status = err.message === 'BODY_TOO_LARGE' ? 413 : 400;
            sendJson(response, status, {
              error: err.message === 'BODY_TOO_LARGE' ? 'Request body exceeds maximum size.' : 'Invalid JSON request body.',
            });
            return;
          }
          if (!body || typeof body.travellerId !== 'string' || !body.travellerId.trim()
            || typeof body.optionId !== 'string' || !body.optionId.trim()) {
            sendJson(response, 400, { error: 'travellerId and optionId are required.' });
            return;
          }
          try {
            const serverTime = now();
            let existingWager = store.getWagerByEventId(eventId, null, serverTime);
            if (!existingWager) {
              let snapshot = null;
              try {
                if (typeof world.semanticSnapshot === 'function') snapshot = world.presentationSnapshot?.() ?? world.semanticSnapshot();
              } catch {}
              const detected = detectWagerForEvent(event, snapshot, serverTime);
              if (detected) {
                store.createWager(detected, serverTime);
              }
            }

            const updated = store.castWagerVote(eventId, body.travellerId, body.optionId, serverTime);
            sendJson(response, 200, {
              success: true,
              wager: updated,
              userVote: body.optionId,
            });
            return;
          } catch (err) {
            if (err.message === 'WAGER_NOT_FOUND') {
              sendJson(response, 404, { error: 'No wager found for this event.' });
              return;
            }
            if (err.message === 'WAGER_CLOSED') {
              sendJson(response, 400, { error: 'Prophecy wager is closed for voting.' });
              return;
            }
            sendJson(response, 400, { error: err.message });
            return;
          }
        }

        if (action === 'react') {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Use POST for this endpoint.' }, { Allow: 'POST' });
            return;
          }
          let body;
          try {
            body = await readJsonBody(request);
          } catch (err) {
            const status = err.message === 'BODY_TOO_LARGE' ? 413 : 400;
            sendJson(response, status, {
              error: err.message === 'BODY_TOO_LARGE' ? 'Request body exceeds maximum size.' : 'Invalid JSON request body.',
            });
            return;
          }
          if (!body || typeof body.reaction !== 'string') {
            sendJson(response, 400, { error: 'A reaction string is required.' });
            return;
          }
          try {
            const delta = body.delta === -1 ? -1 : 1;
            store.addReaction(eventId, body.reaction, delta);
          } catch (err) {
            sendJson(response, 400, { error: err.message });
            return;
          }
          const updated = store.getSocial(eventId, event, now());
          sendJson(response, 200, { success: true, eventId, reactions: updated.reactions });
          return;
        }

        if (action === 'comment') {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Use POST for this endpoint.' }, { Allow: 'POST' });
            return;
          }
          let body;
          try {
            body = await readJsonBody(request);
          } catch (err) {
            const status = err.message === 'BODY_TOO_LARGE' ? 413 : 400;
            sendJson(response, status, {
              error: err.message === 'BODY_TOO_LARGE' ? 'Request body exceeds maximum size.' : 'Invalid JSON request body.',
            });
            return;
          }
          if (!body || typeof body.text !== 'string' || !body.text.trim()) {
            sendJson(response, 400, { error: 'Comment text is required.' });
            return;
          }
          let createdComment;
          try {
            createdComment = store.addComment(eventId, body);
          } catch (err) {
            sendJson(response, 400, { error: err.message });
            return;
          }
          const updated = store.getSocial(eventId, event, now());
          sendJson(response, 200, {
            success: true,
            comment: createdComment,
            totalComments: updated.totalComments,
          });
          return;
        }
      }

      if (pathname === '/api/tracks') {
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify({ tracks: trackList }));
        return;
      }
      if (pathname === '/api/ambient-sources') {
        if (!['GET', 'HEAD'].includes(request.method)) {
          sendJson(response, 405, { error: 'Use GET for sound settings.' }, { Allow: 'GET, HEAD' });
          return;
        }
        sendJson(response, 200, { sources: publicAmbientSources(ambientPresent) });
        return;
      }
      const asset = assets.get(pathname);
      if (asset) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          sendJson(response, 405, { error: 'Use GET for this page.' }, { Allow: 'GET, HEAD' });
          return;
        }
        // Audio is served with byte ranges. Some browsers — Safari most firmly —
        // will not play a media element the server answers with a flat 200, and
        // seeking needs it regardless. It is also the one thing here worth
        // caching: re-fetching three megabytes on every track change is waste,
        // and a music file carries nothing private.
        if (asset.media) {
          const total = asset.bytes.length;
          const headers = { 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400' };
          const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || '');
          if (range && (range[1] || range[2])) {
            const start = range[1] ? Number(range[1]) : total - Number(range[2]);
            const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
            if (!Number.isFinite(start) || start < 0 || start > end || end >= total) {
              send(response, 416, asset.type, undefined, { 'Content-Range': `bytes */${total}` });
              return;
            }
            send(response, 206, asset.type, request.method === 'HEAD' ? undefined : asset.bytes.subarray(start, end + 1),
              { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}` });
            return;
          }
          send(response, 200, asset.type, request.method === 'HEAD' ? undefined : asset.bytes, headers);
          return;
        }
        send(response, 200, asset.type, request.method === 'HEAD' ? undefined : asset.bytes);
        return;
      }

      // Never derive a filesystem path from the URL.
      sendJson(response, 404, { error: 'Not found.' });
    } catch {
      // Private state, database paths and exception stacks never cross this API.
      sendJson(response, 503, { error: 'The local world is temporarily unavailable. Please try again.' });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  if (!audienceStore) server.once('close', () => { try { audience.close(); } catch {} });
  if (!feedbackStore) server.once('close', () => { try { feedback.close(); } catch {} });
  if (!socialStore) {
    server.once('close', () => {
      try {
        store.close();
      } catch {}
    });
  }
  if (ownsCinematicStore) {
    server.once('close', () => {
      try { sceneStore.close(); } catch {}
    });
  }
  server.runSceneReservoirMaintenance = runSceneReservoirMaintenance;
  return server;
}

export function startLocalServer({ port = PORT, dbPath } = {}) {
  // A rules upgrade must never silently select a fresh canonical history.
  // An explicit isolated path also isolates its social/presentation stores.
  const world = openStartupWorld({ dataDirectory: join(directory, 'data'), dbPath });
  const companionPath = suffix => dbPath === ':memory:' ? ':memory:' : `${resolve(dbPath)}.${suffix}.sqlite`;
  const socialStore = openSocialStore({ dbPath: dbPath === undefined
    ? join(directory, 'data', 'world.sqlite') : companionPath('social') });
  const cinematicStore = openCinematicStore({ dbPath: dbPath === undefined
    ? join(directory, 'data', 'worldstream-cinematics.sqlite') : companionPath('cinematics') });
  const feedbackStore = openFeedbackStore({ dbPath: dbPath === undefined
    ? join(directory, 'data', 'worldstream-feedback.sqlite') : companionPath('feedback') });
  const audienceStore = openAudienceStore({ dbPath: dbPath === undefined
    ? join(directory, 'data', 'worldstream-audience.sqlite') : companionPath('audience'),
    ttlMs: cinematicConfig().activeViewerTtlMs });
  const server = createApp({ world, socialStore, feedbackStore, audienceStore, cinematicStore });
  let closed = false;
  const closeWorld = () => {
    if (!closed) {
      world.close();
      socialStore.close();
      cinematicStore.close();
      feedbackStore.close();
      audienceStore.close();
      closed = true;
    }
  };
  const shutdown = () => {
    server.close(closeWorld);
    server.closeIdleConnections();
  };
  server.once('close', closeWorld);
  server.once('error', () => {
    closeWorld();
    process.stderr.write(`Could not start Silver Clouds on http://${BIND_ADDRESS}:${port}. The port may already be in use.\n`);
    process.exitCode = 1;
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.listen(port, BIND_ADDRESS, () => {
    process.stdout.write(`Silver Clouds — Now: http://${BIND_ADDRESS}:${port}\n`);
  });
  return server;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try { startLocalServer(); }
  catch (error) {
    process.stderr.write(`Silver Clouds startup refused: ${error.message}\n`);
    process.exitCode = 1;
  }
}

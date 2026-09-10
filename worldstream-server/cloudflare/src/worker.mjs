/**
 * Cloudflare Worker Entrypoint for Worldstream.
 * 
 * Routes incoming HTTP and WebSocket requests to the single authoritative
 * SQLite-backed WorldDurableObject instance.
 */

import { WorldDurableObject } from './world-durable-object.mjs';

export { WorldDurableObject };

// A Durable Object comes into existence the first time anything fetches its
// stub, and the moment it does it fixes its own epoch for good. So the gate
// below is not decoration: before the launch instant this Worker answers every
// route itself and never reaches the stub, which is the only way to be sure no
// smoke test, uptime check, crawler or stray deploy request starts the world
// early and bakes in the wrong epoch.
//
// `LAUNCH_MS` is the public opening instant in epoch milliseconds. Leaving it
// unset means no gate at all, which is what local development and staging want.
const launchAt = (env) => {
  const value = Number(env.LAUNCH_MS);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

// How long before the opening instant the scheduled trigger may create the
// world. One firing inside this window does the work; every firing outside it —
// including every day after launch — returns immediately, so the mechanism
// needs no stored state and no second deploy to switch itself off.
const WAKE_WINDOW_MS = 15 * 60_000;

/** Which world this deployment talks to. Configuration only, never a request. */
const worldName = (env) => (typeof env.WORLD_ID === 'string' && env.WORLD_ID.trim()
  ? env.WORLD_ID.trim() : 'authoritative-world');

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Allowed origins for CORS
    const allowedOrigins = env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',').map(o => o.trim())
      : ['*'];
    const origin = request.headers.get('Origin');
    const allowOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))
      ? (origin || '*')
      : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      // `x-client-id` is sent on every reader request by `viewerFetch`, so omitting
      // it from the allow-list blocked presence, observation and the cinematic
      // feed at the preflight. Same-origin development never showed it.
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-id, x-viewer-token, Upgrade',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check directly at worker level
    if (url.pathname === '/worker-health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        worker: 'silver-clouds-worldstream',
        timestamp: Date.now()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Closed until the opening instant. This answers before the Durable Object
    // binding is used at all, so a request arriving early cannot create the
    // world; `/worker-health` above still answers, which is what a health check
    // should be reaching anyway.
    const opensAt = launchAt(env);
    if (opensAt !== null && Date.now() < opensAt) {
      return new Response(JSON.stringify({ status: 'not_open', opensAt }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.max(1, Math.ceil((opensAt - Date.now()) / 1000))),
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      });
    }

    // Route to the authoritative singleton Durable Object
    if (!env.WORLD_DO) {
      return new Response(JSON.stringify({
        error: 'WORLD_DO Durable Object binding is missing.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Named singleton: exactly ONE authoritative shared world exists across the globe
    // Which world this Worker talks to. The name is the whole of a Durable
    // Object's identity: two different names are two different objects with two
    // different SQLite databases, so a staging world cannot see, alter or be
    // altered by production. Nothing else separates them, and nothing else
    // needs to.
    //
    // `WORLD_ID` was already configured and already meant "which world"; it was
    // simply never used for the thing it names. The default preserves the
    // existing local object so no development history is orphaned by this
    // change — a new default would have silently started an empty world.
    const worldId = typeof env.WORLD_ID === 'string' && env.WORLD_ID.trim()
      ? env.WORLD_ID.trim() : 'authoritative-world';
    const doId = env.WORLD_DO.idFromName(worldId);
    const worldStub = env.WORLD_DO.get(doId);

    // Forward request to the authoritative DO
    const response = await worldStub.fetch(request);

    // Add CORS headers to response if not already present
    const responseHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      if (!responseHeaders.has(key)) {
        responseHeaders.set(key, value);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  },

  /**
   * The scheduled launch. A cron a few minutes before the opening instant is
   * the only thing permitted to create the world, and it does so by making the
   * ordinary reader bootstrap call: the object initialises from `START_MS` and
   * `WORLD_SEED`, then catches up to the present, so the first visitor at
   * opening time meets a world with its history already in place rather than
   * one being built under them.
   *
   * Every firing outside the pre-launch window does nothing at all, so this is
   * safe to leave installed permanently and never needs turning off.
   */
  async scheduled(event, env, ctx) {
    const opensAt = launchAt(env);
    if (opensAt === null || !env.WORLD_DO) return;
    const now = Date.now();
    if (now >= opensAt || now < opensAt - WAKE_WINDOW_MS) return;
    const stub = env.WORLD_DO.get(env.WORLD_DO.idFromName(worldName(env)));
    // The hostname is never read by the object; only the path is routed.
    ctx.waitUntil(stub.fetch('https://worldstream.internal/api/observe', { method: 'POST' }));
  },
};

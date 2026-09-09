/**
 * Cloudflare Worker Entrypoint for Worldstream.
 * 
 * Routes incoming HTTP and WebSocket requests to the single authoritative
 * SQLite-backed WorldDurableObject instance.
 */

import { WorldDurableObject } from './world-durable-object.mjs';

export { WorldDurableObject };

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
  }
};

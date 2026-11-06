// Where the authoritative world lives.
//
// The architecture is a static .com frontend talking to a Cloudflare backend on
// the .co.uk zone, and one authoritative shared Worldstream behind it. This page
// therefore never runs a simulation of its own — it asks the backend and renders
// the answer. Everything under /api/ is a call to that backend, not a path on
// this website.
//
// The workshop version was served by a Node process that answered both the
// static files and the API from one origin, so every call was written as a
// relative `/api/...`. Rather than rewrite twenty-three call sites across four
// files — and have to remember the rule for every future one — the base is
// resolved once here and applied to `/api/` requests as they are made.
//
// Configure it with the meta tag in index.html, or set `window.WORLDSTREAM_API`
// before this module loads. An empty value means same-origin, which is what a
// local run through a single proxy wants.

const meta = document.querySelector('meta[name="worldstream-api"]')?.content?.trim();
const configured = (globalThis.WORLDSTREAM_API ?? meta ?? '').trim();

/** Backend origin, with any trailing slash removed. '' means same-origin. */
export const WORLDSTREAM_API = configured.replace(/\/+$/, '');

/** Resolve a backend path against the configured base. */
export const apiUrl = (path) => (WORLDSTREAM_API ? `${WORLDSTREAM_API}${path}` : path);

if (WORLDSTREAM_API) {
  const native = globalThis.fetch.bind(globalThis);
  // Only same-origin, root-relative /api/ requests are redirected. An absolute
  // URL, a cross-origin request, or anything already pointing at the backend is
  // left exactly as it was.
  globalThis.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) return native(apiUrl(input), init);
    if (input instanceof Request && new URL(input.url, location.href).origin === location.origin
      && new URL(input.url, location.href).pathname.startsWith('/api/')) {
      const url = new URL(input.url, location.href);
      return native(new Request(apiUrl(url.pathname + url.search), input), init);
    }
    return native(input, init);
  };
  // Credentials are not sent cross-origin by default and the backend identifies
  // a reader by header rather than cookie, so nothing else needs changing here.
  console.info(`[worldstream] backend: ${WORLDSTREAM_API}`);
} else {
  console.info('[worldstream] backend: same origin');
}

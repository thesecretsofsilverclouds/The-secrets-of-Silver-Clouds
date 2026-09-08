import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// One command to run the integrated site locally.
//
//     node worldstream-server/dev.mjs
//
// It starts two things, which is what the deployed shape actually is:
//
//   * the **website**, served as plain static files on :4322 — exactly what a
//     static host will do with this repository, no server-side rendering, no
//     simulation in the page;
//   * the **Cloudflare backend**, through `wrangler dev` on :8787 — the real
//     Worker and the real SQLite Durable Object, not a stand-in.
//
// The page is served from a different origin to the API on purpose. That is the
// deployed architecture (.com frontend, .co.uk backend) and running it any other
// way locally would hide CORS problems until the first deploy. The site port is
// listed in the worker's CORS_ORIGINS.
//
// Nothing here is deployed and nothing here publishes. Stop it with Ctrl-C.

const ROOT = fileURLToPath(new URL('..', import.meta.url));   // the website repo
// 4322 and 4317 are the workshop project's own ports and may already be in
// use by a running world; this stack gets its own so the two can coexist.
// Override with WORLDSTREAM_SITE_PORT if 4323 is taken too.
const SITE_PORT = Number(process.env.WORLDSTREAM_SITE_PORT ?? 4323);
const API_PORT = 8787;
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const APP_PATH = '/worldstream/app/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

/** Refuse anything that climbs out of the repository. */
function resolveSafe(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const target = normalize(join(ROOT, decoded));
  return target.startsWith(ROOT.replace(/[\\/]+$/, '') + sep) || target === ROOT ? target : null;
}

const site = createServer(async (request, response) => {
  let target = resolveSafe(request.url ?? '/');
  if (!target) { response.writeHead(403).end('outside the site'); return; }
  try {
    let info = await stat(target).catch(() => null);
    if (info?.isDirectory()) { target = join(target, 'index.html'); info = await stat(target).catch(() => null); }
    if (!info) { response.writeHead(404).end('not found'); return; }

    let body = await readFile(target);
    // Point the app at the local backend. The committed page carries the
    // deployed value; this override exists only while developing, so the file
    // on disk never has to be edited to run locally and never has to be
    // remembered to change back.
    if (target.endsWith('index.html') && request.url?.startsWith(APP_PATH)) {
      body = Buffer.from(String(body).replace('</title>',
        `</title>\n  <script>window.WORLDSTREAM_API = ${JSON.stringify(API_ORIGIN)};</script>`));
    }
    response.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    }).end(body);
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});

site.listen(SITE_PORT, '127.0.0.1', () => {
  console.log(`\n  website   http://127.0.0.1:${SITE_PORT}/`);
  console.log(`  the app   http://127.0.0.1:${SITE_PORT}${APP_PATH}`);
  console.log(`  backend   ${API_ORIGIN}  (wrangler dev, starting…)\n`);
});

// The real Cloudflare tooling, against the real Durable Object.
//
// The installed binary rather than `npx wrangler`: npx resolves a version at
// run time, and it picked one that did not exist in the registry, which failed
// the whole start-up. Wrangler is pinned in package.json instead, so `npm
// install` once and every run afterwards uses the same version offline.
//
// `shell: true` on Windows: Node refuses to spawn a `.cmd` shim directly
// (EINVAL), and the wrangler shim is a .cmd here.
const onWindows = process.platform === 'win32';
const wranglerBin = join(ROOT, 'worldstream-server', 'node_modules', '.bin',
  onWindows ? 'wrangler.cmd' : 'wrangler');
const wrangler = spawn(wranglerBin, ['dev', '--port', String(API_PORT), '--ip', '127.0.0.1'],
  { cwd: join(ROOT, 'worldstream-server', 'cloudflare'), stdio: 'inherit', shell: onWindows });

wrangler.on('exit', (code) => {
  console.log(`\nwrangler dev exited (${code}). Stopping the site server.`);
  site.close();
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { wrangler.kill(); site.close(); process.exit(0); });
}

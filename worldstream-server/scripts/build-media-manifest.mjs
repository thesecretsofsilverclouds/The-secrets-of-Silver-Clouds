import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAmbientAudioFile, publicAmbientSources, AMBIENT_ASSETS } from '../src/ambient-assets.mjs';

// Regenerate cloudflare/src/media-manifest.mjs from the audio in the app.
//
//     node worldstream-server/scripts/build-media-manifest.mjs [import-from-dir]
//
// `worldstream/app/audio/` is the single home for track audio: it is what the
// static site serves, and a Durable Object has no filesystem to serve it from.
// The manifest is metadata only — slug, title, duration — and exists so the API
// can list tracks without reading a disk.
//
// Files are named by slug because that is the URL the page asks for. The title
// cannot always be recovered from a slug ("legends-of-dawn" is *Legends of
// Dawn*, not *Legends Of Dawn*), so titles are captured here, once, from the
// original filenames and then carried in the manifest.
//
// Pass a directory to import from — e.g. the old `Assets/` folder, or wherever
// new tracks are dropped with their real names. Each file is slugged, copied
// into the app, and its title taken from its filename exactly as the Node
// server used to derive it.

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..');
const APP_AUDIO = join(SERVER, '..', 'worldstream', 'app', 'audio');
const APP_AMBIENT = join(SERVER, '..', 'worldstream', 'app', 'ambient');
const MANIFEST = join(SERVER, 'cloudflare', 'src', 'media-manifest.mjs');
const MOUNT = '/worldstream/app';

/** The same slug the Node server has always produced from a filename. */
const slugOf = (file) => file.replace(/\.mp3$/i, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleOf = (file) => file.replace(/\.mp3$/i, '');

mkdirSync(APP_AUDIO, { recursive: true });

// Titles already known, so a rebuild never loses one to slug round-tripping.
const known = new Map();
if (existsSync(MANIFEST)) {
  const previous = readFileSync(MANIFEST, 'utf8');
  const block = previous.match(/export const TRACKS = Object\.freeze\((\[[\s\S]*?\])\);/);
  if (block) for (const track of JSON.parse(block[1])) known.set(track.slug, track.title);
}

// Import any newly dropped originals, then take the app folder as the truth.
const importFrom = process.argv[2] ? join(process.cwd(), process.argv[2]) : null;
if (importFrom && existsSync(importFrom)) {
  for (const file of readdirSync(importFrom)) {
    if (!file.toLowerCase().endsWith('.mp3')) continue;
    if (isAmbientAudioFile(file)) {
      // Ambient audio has its own home and its own URLs.
      const asset = Object.values(AMBIENT_ASSETS).find((item) => item.file === file);
      if (asset) {
        mkdirSync(APP_AMBIENT, { recursive: true });
        copyFileSync(join(importFrom, file), join(APP_AMBIENT, asset.url.split('/').pop()));
      }
      continue;
    }
    const slug = slugOf(file);
    known.set(slug, titleOf(file));
    const target = join(APP_AUDIO, `${slug}.mp3`);
    if (!existsSync(target)) copyFileSync(join(importFrom, file), target);
  }
}

const tracks = readdirSync(APP_AUDIO)
  .filter((file) => file.toLowerCase().endsWith('.mp3'))
  .map((file) => {
    const slug = file.replace(/\.mp3$/i, '');
    // A track dropped in without a known title still plays; it is simply
    // listed under its slug until somebody gives it a better one.
    return { slug, title: known.get(slug) ?? slug, seconds: null };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

const ambientFiles = existsSync(APP_AMBIENT) ? readdirSync(APP_AMBIENT) : [];
const present = Object.values(AMBIENT_ASSETS)
  .filter((asset) => ambientFiles.includes(asset.url.split('/').pop()))
  .map((asset) => asset.file);
const sources = Object.fromEntries(Object.entries(publicAmbientSources(present))
  .map(([key, value]) => [key, { ...value, url: `${MOUNT}${value.url}` }]));

writeFileSync(MANIFEST, `// Media metadata, generated from the audio in worldstream/app/audio and
// worldstream/app/ambient. **Do not edit by hand.**
//
// These are files, not world state. A Durable Object has no filesystem and this
// listing does not change as the world advances, so it is a static manifest
// rather than rows in the authoritative database. The audio itself is served by
// the static site alongside the rest of the app; only the listing comes from
// the API, which is the same split \`server.mjs\` has between its asset map and
// its \`/api/tracks\` response.
//
// Regenerate with:
//   node worldstream-server/scripts/build-media-manifest.mjs [import-from-dir]

export const TRACKS = Object.freeze(${JSON.stringify(tracks, null, 2)});

export const AMBIENT_SOURCES = Object.freeze(${JSON.stringify(sources, null, 2)});
`);

console.log(`tracks: ${tracks.length}, ambient sources: ${Object.keys(sources).length}`);
console.log(`manifest: ${MANIFEST}`);

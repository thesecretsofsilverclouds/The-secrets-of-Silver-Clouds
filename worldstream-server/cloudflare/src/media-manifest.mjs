// Media metadata, generated from the audio in worldstream/app/audio and
// worldstream/app/ambient. **Do not edit by hand.**
//
// These are files, not world state. A Durable Object has no filesystem and this
// listing does not change as the world advances, so it is a static manifest
// rather than rows in the authoritative database. The audio itself is served by
// the static site alongside the rest of the app; only the listing comes from
// the API, which is the same split `server.mjs` has between its asset map and
// its `/api/tracks` response.
//
// Regenerate with:
//   node worldstream-server/scripts/build-media-manifest.mjs [import-from-dir]

export const TRACKS = Object.freeze([
  {
    "slug": "arcade-after-dark",
    "title": "Arcade After Dark",
    "seconds": null
  },
  {
    "slug": "dunk-no-jutsu",
    "title": "Dunk No Jutsu",
    "seconds": null
  },
  {
    "slug": "floating-night",
    "title": "floating night",
    "seconds": null
  },
  {
    "slug": "glitch-pocket-riot",
    "title": "Glitch Pocket Riot",
    "seconds": null
  },
  {
    "slug": "last-breath",
    "title": "last breath",
    "seconds": null
  },
  {
    "slug": "legends-of-dawn",
    "title": "Legends of Dawn",
    "seconds": null
  },
  {
    "slug": "little-star",
    "title": "little star",
    "seconds": null
  },
  {
    "slug": "magic",
    "title": "Magic",
    "seconds": null
  },
  {
    "slug": "midnight-static-loop",
    "title": "Midnight Static Loop",
    "seconds": null
  },
  {
    "slug": "mowtown-towers",
    "title": "mowtown-towers",
    "seconds": null
  },
  {
    "slug": "mowtown-towers3",
    "title": "mowtown towers3",
    "seconds": null
  },
  {
    "slug": "neon-arcade-hustle",
    "title": "Neon Arcade Hustle",
    "seconds": null
  },
  {
    "slug": "oracle",
    "title": "Oracle",
    "seconds": null
  },
  {
    "slug": "silver-clouds",
    "title": "silver clouds",
    "seconds": null
  },
  {
    "slug": "tiny-rebel",
    "title": "Tiny Rebel",
    "seconds": null
  },
  {
    "slug": "touchscreen-drift",
    "title": "Touchscreen Drift",
    "seconds": null
  },
  {
    "slug": "vega",
    "title": "vega",
    "seconds": null
  },
  {
    "slug": "wooburn-forest",
    "title": "wooburn forest",
    "seconds": null
  }
]);

export const AMBIENT_SOURCES = Object.freeze({
  "rain_heavy": {
    "url": "/worldstream/app/ambient/rain-heavy.mp3",
    "label": "Rain",
    "automatic": true
  },
  "rain_sheltered": {
    "url": "/worldstream/app/ambient/rain-sheltered.mp3",
    "label": "Rain recording — setting awaiting review",
    "automatic": false
  },
  "city": {
    "url": "/worldstream/app/ambient/city.mp3",
    "label": "City ambience",
    "automatic": true
  }
});

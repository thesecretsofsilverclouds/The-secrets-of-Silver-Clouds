// Only these three files are environmental beds. Other MP3s remain score
// candidates; a filename containing "night" or "clouds" is not an SFX rule.
// Inspection: MPEG headers, not an auditory review. The truncated second
// filename does not establish whether its setting is a building or a bus.
export const AMBIENT_ASSETS = Object.freeze({
  rain_heavy: Object.freeze({
    file: 'ambient_rain_heavy.mp3', url: '/ambient/rain-heavy.mp3',
    label: 'Rain', automatic: true,
  }),
  rain_sheltered: Object.freeze({
    file: 'ambient_rain_in_a_bu_#4-1788638976971.mp3', url: '/ambient/rain-sheltered.mp3',
    label: 'Rain recording — setting awaiting review', automatic: false,
  }),
  city: Object.freeze({
    file: 'background_sounds_ofcity.mp3', url: '/ambient/city.mp3',
    label: 'City ambience', automatic: true,
  }),
});

export const AMBIENT_AUDIO_FILES = Object.freeze(Object.values(AMBIENT_ASSETS).map(item => item.file));
const ambientNames = new Set(AMBIENT_AUDIO_FILES.map(file => file.toLowerCase()));
export const isAmbientAudioFile = filename => ambientNames.has(String(filename).toLowerCase());

/** Browser metadata exposes registered routes, never local asset filenames. */
export function publicAmbientSources(availableFiles = null) {
  const available = availableFiles == null ? null : new Set([...availableFiles].map(file => String(file).toLowerCase()));
  return Object.fromEntries(Object.entries(AMBIENT_ASSETS)
    .filter(([, asset]) => !available || available.has(asset.file.toLowerCase()))
    .map(([key, { url, label, automatic }]) => [key, { url, label, automatic }]));
}

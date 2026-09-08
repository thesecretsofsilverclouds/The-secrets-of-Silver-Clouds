import { createAtmosphere } from './atmosphere.js';
const controls = ['weather', 'phase', 'location'].map(name => document.querySelector(`#preview-${name}`));
const query = new URLSearchParams(location.search);
for (const [index, name] of ['weather', 'phase', 'location'].entries()) {
  const value = query.get(name);
  if ([...controls[index].options].some(option => option.value === value)) controls[index].value = value;
}
const atmosphere = createAtmosphere();
function render() {
  const [weatherCode, phase, location] = controls.map(input => input.value);
  document.body.dataset.phase = phase;
  const night = phase === 'night' || phase === 'dusk';
  const backdrops = { london: night ? 'world-london-night.jpg' : 'world-london-day.jpg',
    mi6: night ? 'world-mi6-night.jpg' : 'world-mi6-day.jpg',
    streamliner: night ? 'world-streamliner-night.jpg' : 'world-streamliner-day.jpg',
    sanctuary: night ? 'world-sanctuary-night.jpg' : 'world-sanctuary-day.jpg' };
  document.querySelector('.world-backdrop-layer').style.backgroundImage = `url('/worldstream/app/scene/${backdrops[location]}')`;
  atmosphere.update({ weather: { code: weatherCode }, time: { dayPhase: phase, daylight: { dawn: .35, day: 1, dusk: .2, night: 0 }[phase] },
    characters: [], scene: { location } });
  document.querySelector('#preview-title').textContent = `${controls[2].selectedOptions[0].textContent} · ${controls[0].selectedOptions[0].textContent}`;
  document.querySelector('#preview-note').textContent = phase === 'night'
    ? 'The road sprites sleep at the edges of the page, here and in the live world.'
    : 'A road sprite passes occasionally along the bottom. First arrival in about eight seconds.';
}
controls.forEach(input => input.addEventListener('change', render));
render();

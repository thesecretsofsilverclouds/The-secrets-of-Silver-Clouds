import { viewFrom } from '../engine/engine.mjs';
import { explain, renderExplanation } from './explain.mjs';

const TRAITS = {
  emily: ['counts_things','answers_literally','reads_as_child','unhurried','no_social_debt'],
  ashai: ['protective','norm_compliant','finishes_the_movement'],
  goaden: ['watchful','deadpan','unbothered','deflects_concern'],
  yukon: ['loud','competitive','impatient','physical'],
};
const ABIL = { emily: ['fade'], yukon: ['shapeshift'], ashai: [], goaden: [] };

const situation = who => viewFrom([
  'world.daypart.midday','world.weather.heavy_rain','world.faction.arcane.low',
  `char.${who}`, `here.${who}.plaza`, `free.${who}`, `alone.${who}`,
  `activity.${who}.unhurried_time`,
  ...TRAITS[who].map(t => `trait.${who}.${t}`),
  ...ABIL[who].map(a => `ability.${who}.${a}`),
  'obstacle.standing_water.at.plaza','obstacle.standing_water.tag.navigable',
  'affordance.plaza_shadows.at.plaza','affordance.plaza_shadows.tag.shadowed',
  'affordance.plaza_shadows.tag.perceptible','affordance.plaza_shadows.tag.countable',
  'affordance.market_stall.at.plaza','affordance.market_stall.tag.askable',
  'practice.minor_inconvenience.plaza',
]);

console.log('THE SAME PUDDLE, FOUR PEOPLE\n' + '='.repeat(70));
for (const who of ['emily','ashai','goaden','yukon']) {
  console.log('\n' + renderExplanation(explain({ view: situation(who), actor: who }), { limit: 5 }));
}

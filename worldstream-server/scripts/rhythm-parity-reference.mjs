// Prints the parity digests for the current checkout. Run this ON v29 CODE to
// produce the reference constants in test/rhythm-parity.test.mjs; on v30 code it
// prints what the disabled path currently produces, for comparison.
import { parityView, parityDigest, runParityWorld } from '../test/helpers/rhythm-parity.mjs';
import { RULES_VERSION, DEFAULT_SEED } from '../src/fixture.mjs';

const seeds = [DEFAULT_SEED, 'rhythm-parity-b'];
const out = { rulesVersion: RULES_VERSION, seeds: {} };
for (const seed of seeds) out.seeds[seed] = parityDigest(parityView(runParityWorld(seed)));
console.log(JSON.stringify(out, null, 2));

# Code provenance and licence record

What was copied, what was adapted, what was only read. Recorded because the
answer determines what Worldstream would owe if any of this were adopted.

## External repositories

Both cloned read-only into `lab/research/` for inspection. **Neither is
vendored into Worldstream, and neither is imported by any file outside
`lab/research/`.**

| repo | commit source | licence | obligation if code were used |
|---|---|---|---|
| [mkremins/praxish](https://github.com/mkremins/praxish) | `--depth 1`, cloned 2026-09-07 | MIT (Copyright 2025 Max Kreminski) | Retain the copyright notice and the permission notice in copies or substantial portions. No advertising or product-acknowledgement clause. |
| [ensemble-engine/ensemble](https://github.com/ensemble-engine/ensemble) | `--depth 1`, cloned 2026-09-07 | **BSD-4-Clause** (Copyright 2019 The Regents of the University of California) | Clauses 1 and 2 are the ordinary notice requirements. **Clause 3 is the advertising clause**: *"All advertising materials mentioning features or use of this software must display the following acknowledgement: This product includes software developed by the University of California, Santa Cruz and its contributors."* Clause 4 forbids using the University's name to endorse derived products. |

### On the Ensemble licence specifically

BSD-4-Clause is not BSD-3-Clause. The advertising clause is the reason the
Free Software Foundation considers it GPL-incompatible, and its practical
effect here would be that **marketing copy for Silver Clouds mentioning the
world simulation would have to carry a UC Santa Cruz acknowledgement.** That is
a product-level obligation, not a source-file one, and it should be a
deliberate decision rather than something discovered later.

Nothing in this lab creates that obligation. No Ensemble code is used.

## What this lab actually contains

| file | provenance |
|---|---|
| `engine/facts.mjs` | **Concept reproduced, no code copied.** The path-tree fact store and the uppercase-initial variable convention are Praxish's design. Written from scratch, with two documented departures from its semantics (explicit `setOne` instead of `!`; fresh binding objects from `unify`). |
| `engine/query.mjs` | **Concept reproduced, no code copied.** The condition-operator set (`not`/`eq`/`neq`/`lt`/`gt`/`calc`/`count`) is Praxish's vocabulary. The kill-tracing idea is Praxish's `impossibleActions`. Implementation, error handling, load-time validation and the `because` field are original. |
| `engine/score.mjs` | **Concept adapted, no code copied.** The influence/volition split and speculative-execution-then-evaluate loop are Swaygent's design and are the best idea in either repository. Four documented behavioural departures (forbidden actions removed not sorted; per-candidate cloning; finite-score assertion; manner weighting). |
| `engine/practices.mjs`, `engine/grammar.mjs` | Original. Practice shape is Praxish's; `intent` + `surface` separation is Ensemble's Action Library idea, reproduced conceptually — Ensemble's `leadsTo` grammar walk is **not** implemented. |
| `engine/engine.mjs`, `engine/adapter.mjs`, `engine/validate.mjs`, `engine/rng.mjs` | Original. No analogue in either repository; the adapter and validator exist precisely because neither repository has a concept of an external authoritative world. |
| `gazette/*` | Original. Newsworthiness dimensions, thread model, source boundary and correction loop are new work. Extends `src/dispatch.mjs`'s existing Gazette rather than replacing it. |
| `grammar/*`, `harness/*` | Original. |
| `research/praxish-probe.mjs`, `research/probe-0*.mjs` | Original test harnesses. They **read** Praxish's source at runtime via `node:vm` to measure its behaviour; they do not copy or redistribute it. |

**Nothing under `lab/research/praxish/` or `lab/research/ensemble/` is imported
by `lab/engine`, `lab/grammar`, `lab/gazette` or `lab/harness`.** The probes are
the only files that touch them, and they are investigation artefacts.

## Verification

```bash
cd lab && grep -rn "research/" engine grammar gazette harness | grep -v "^harness/.*probe"
```

Returns only documentation comments citing probe filenames as evidence. No
imports.

## Reads from Worldstream production source

The lab imports these **read-only** and modifies none of them:

`src/world.mjs`, `src/time.mjs`, `src/places.mjs`, `src/sky.mjs`,
`src/cast.mjs`, `src/spoilers.mjs`, `src/fixture.mjs`,
`src/offscreen-lives.mjs`, `src/moments.mjs`.

No production file was edited during this investigation. No database was
written to other than `:memory:`.

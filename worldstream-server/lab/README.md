# Moment Engine lab

Investigation only. **No production file was modified.** Nothing here is
imported by `src/` or `server.mjs`; the dependency runs one way, lab → src, and
read-only.

- **[DECISION-PACKAGE.md](DECISION-PACKAGE.md)** — the ten-item finish-line report. Start here.
- **[REPORT.md](REPORT.md)** — the investigation report, sections A–M.
- **[REPORT-V2.md](REPORT-V2.md)** — the refinement round after the author's review. Read this one second.
- **[runs/human-review-analysis.md](runs/human-review-analysis.md)** — the author's 52 verdicts, analysed.
- **[runs/ab-v1-v2.md](runs/ab-v1-v2.md)** — v1 vs v2 on the identical seed, failure by failure.
- **[TRACK-C-findings.md](TRACK-C-findings.md)** — opportunity and reach diagnosis, read-only.
- **[TRACK-D-opportunity-director.md](TRACK-D-opportunity-director.md)** — Director proposal + acceptance tests. Not implemented.
- **[FINDING-pacing-leak.md](FINDING-pacing-leak.md)** — the bounded decision/presentation coupling.
- **[MUSIC-CHECK.md](MUSIC-CHECK.md)** — why the score felt repetitive, and the applied fix.
- **[PROVENANCE.md](PROVENANCE.md)** — what was copied, adapted or only read, and the licence position.

## Run it

```bash
cd lab
node --test harness/tests.mjs      # the 7 acceptance tests + 5 rails
node harness/compare.mjs 30        # control vs lab, quality, leverage
node harness/review.mjs 90         # author-review sample, five labels
node harness/ab.mjs               # v1 vs v2 against the human verdicts
node review/analyse.mjs           # the author's review, turned into numbers
node harness/demo-explain.mjs      # "why did Emily use Fade?" — same puddle, four people
node harness/loop-demo.mjs         # Gazette claim -> correction -> new character action
node harness/gazette-run.mjs 30    # 30 days of the newspaper
node harness/tune.mjs              # interest-floor sweep
node harness/packet.mjs 90         # the v2 review packet
node harness/opportunity-map.mjs  # read-only reach analysis
node studio/candidate-targets.mjs # which banks are empirically starved
node studio/compare-before-after.mjs baseline   # before the Studio hour
node studio/compare-before-after.mjs report ID  # after it
node --test shadow/fixtures.test.mjs            # shadow contract
node research/probe-03-aliasing.mjs   # the Praxish defect that decided the recommendation
```

## Layout

```
engine/     the Moment Engine. No state, no persistence, no prose.
  facts     transient path-tree fact view, rebuilt per opportunity
  query     conditions + kill tracing ("why not?")
  practices situation definitions
  grammar   character grammar definitions
  score     candidate enumeration, hard rails, influence/drive scoring
  engine    evaluateMomentOpportunity() -> MomentProposal | null
  adapter   Worldstream snapshot -> transient facts (one direction only)
  validate  proposal -> committed effects, or a refusal
  rng       seeded determinism; nothing calls Math.random
grammar/    the authored content: 7 practices, 4 characters, 13 places
gazette/    Gazette Engine prototype: newsworthiness, threads, sources, corrections
harness/    runs, tests, measurement, author review, A/B
review/     the author's verdicts on v1, as data. The quality baseline.
studio/     metered authoring infrastructure. Adds no grammar; it is the meter.
shadow/     production shadow-mode contract and fixtures. Wired to nothing.
research/   cloned Praxish + Ensemble, and the probes that measured them.
            Nothing outside this directory imports anything inside it.
runs/       generated output
```

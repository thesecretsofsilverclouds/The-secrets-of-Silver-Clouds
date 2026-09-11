# Addon 2 acceptance — canon-ambient-p183-v25

Generated: 2026-09-11T22:11:46.811Z

## Bar

- one-shot == chunked
- restart == uninterrupted
- differing observer schedules == same canonical history
- 0 model calls, 0 request-time authoring, 0 refill reservations
- MEU cadence remains healthy
- Legion social cadence remains healthy
- ordinary sleep / meals / training / travel remain healthy
- one source cannot open duplicate Legion jobs
- payment exactly once where legitimately reachable
- decline only for real state reasons
- knowledge isolation holds
- removing job prose leaves canonical job history unchanged

## Proof

| Check | Result |
|---|---|
| Model calls | 0 |
| Request-time authoring | 0 |
| Refill reservations | 0 |
| 30d one-shot == chunked | PASS |
| 30d restart | PASS |
| 30d observer schedules | PASS |
| 90d one-shot == chunked | PASS |
| Prose-removal identity | PASS |

## 30-day census

| Seed | MEU opened | MEU/wk | Referrals | Offers | Accepts | Declines | Paid | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| silver-clouds-now-v1 | 6 | 1.4 | 0 | 0 | 0 | 0 | 0 | 178 | 78 | 2 |
| seed-beta | 6 | 1.4 | 0 | 0 | 0 | 0 | 0 | 178 | 81 | 3 |
| seed-gamma | 7 | 1.63 | 0 | 0 | 0 | 0 | 0 | 177 | 79 | 1 |

## 90-day census

| Seed | MEU opened | MEU/wk | Referrals | Offers | Accepts | Declines | Paid | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| silver-clouds-now-v1 | 18 | 1.4 | 0 | 0 | 0 | 0 | 0 | 534 | 237 | 6 |
| seed-beta | 20 | 1.56 | 0 | 0 | 0 | 0 | 0 | 533 | 236 | 7 |
| seed-gamma | 14 | 1.09 | 0 | 0 | 0 | 0 | 0 | 534 | 236 | 4 |

## Digests

30d: silver-clouds-now-v1 `42c1088ce8c99f24519e9e633523c2dd76bc9f57964d9e63a224360b2eac06ba`; seed-beta `8151aafdf4d5e69cee64a29b8d11b17bfc834d72f03b87a6bf8ae420a129da10`; seed-gamma `981f7d6b858bbfec5074a0b11f2bc52365a2c03a1d3ce164f7482672d0dc8561`

90d: silver-clouds-now-v1 `945a594d00adca153caedcf0d885c2ca778e69fdf178ad21af4575d4bf15d31b`; seed-beta `1950c23aec2b0303f40add2bd7db208d5e2539c44d372b42d9c3178d21fd26fd`; seed-gamma `3966b53537308e918f95b7867011f927fd9868ab78e6ba6cb7a03f94cda599a2`

## Deliberately dormant paths

- legion.community_request — no genuine community-request source exists
- legion.magical_cleanup / recovery_or_extraction / information_favour — unused families, reserved for later sources
- referred_to_meu — removed from Addon 2 v1
- future.legionjob.001–.030 — remain inactive
- MEU referred_to_mi6 artefact jurisdiction — never offered to the Legion

Natural job volume is zero across all six census runs. Addon 1 already showed almost no `contained` MEU outcomes, and only `contained` PE-A families may generate `MI6_LEGION_REFERRAL`. That is an honest empty set, not a missing generator.

Lifecycle, payment-once, decline-for-real-unavailability, one-slot-from-offer, and knowledge isolation are proven by injected-source unit tests in `test/legion-jobs.test.mjs`.

## Copy upgrades

| Path | Result |
|---|---|
| Node v24 → v25 pinned copy | PASS (`test/legion-upgrade.test.mjs`) |
| Cloudflare-shaped bare v24 → v25 | PASS |
| Cloudflare DO refuses unupgraded v24 under v25 | PASS |
| Cloudflare DO accepts the upgraded copy | PASS |
| v23 → v24 MEU upgrade is unchanged and does not install Legion jobs | PASS |

## Suites at freeze

| Suite | Result |
|---|---|
| `node --test test/*.test.mjs` | 853/853 pass |
| `cloudflare/test/*.test.mjs` | 30/30 pass |
| Reservoir goldens | 874 / 673 / 91 / 300-inactive unchanged |

# Walkthrough: Addon 4 — Living Places / Onari Ecology & Recovery

## Overview

Addon 4 implements **Living Places / Onari Ecology & Recovery** for Worldstream under the prospective rules boundary `canon-ambient-p183-v27`, following the proven prospective upgrade pattern used in Addons 1–3 (v24/v25/v26).

The subsystem grounds the Onari culture in established lore (custodians of living nature and titan seedlings, peaceful protest, consultation) while providing the world itself with memory: physical consequences are remembered, change local environment states, and heal over time.

---

## Architecture & Invariants

Addon 4 employs a strict dual-subsystem architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Physical Site Consequence Memory                         │
│    (Operates independently from Onari response)             │
│                                                             │
│    SITE_IMPACT_REGISTER                                     │
│            │                                                │
│            ▼                                                │
│    [disturbed] ──(24h dormant check)──► [recovering]        │
│                                              │              │
│                                              ▼              │
│    [stable] ◄──────(Natural: 7d minor / 14d mod)─────────── │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Onari Ecological Response                                │
│    (Reacts when nature/living habitat is disturbed)         │
│                                                             │
│    ONARI_ECOLOGY_NOTICE                                     │
│            │                                                │
│            ▼                                                │
│    ONARI_CONSULTATION                                       │
│      ├── (Agreed) ────────────────────────┐                 │
│      └── (Unresolved) ──► ONARI_PROTEST   │                 │
│                                │          │                 │
│                                ▼          ▼                 │
│                       ONARI_REMEDIATION                     │
│                       (Expedited: 72h minor / 7d mod)       │
│                                │                            │
│                                ▼                            │
│                       ONARI_ECOLOGY_CLOSE                   │
└─────────────────────────────────────────────────────────────┘
```

### Strict Invariants Enforced:
1. **Facts First**: No disturbance or Onari response without an explicit committed source fact (`affectsLivingHabitat: true`, valid `consequenceKind`). Natural disturbance and Onari volume on canonical seeds is exactly 0.
2. **Discrete State Only**: Sites transition solely through `stable`, `disturbed`, and `recovering`. Severities are `minor` or `moderate`. Zero continuous percentage meters.
3. **Canonical Locations Only**: Operates strictly within canonical areas registered in `src/places.mjs`. No invented locations (`london/park`, `embankment`).
4. **Yukon Strictly Optional**: Yukon joins only when awake and offscreen-available. If asleep or travelling, the system functions identically without error or blocking. Zero divided loyalty meters.
5. **Zero Invented Bureaucracy / Placeholder Actors**: No generic `contractor`, `onari_protester`, `planner`, or `onari_liaison` actors.
6. **Zero Prose in State/Payloads**: All state records and event payloads contain 0 narrative prose or text descriptions. Presentation is handled separately by editorial decorators.
7. **Future Prose Quarantine**: All 30 scenes in `future_onari_environment` (`future.onari.001`–`future.onari.030`) remain strictly quarantined in `staged_future` in Batch 04.

---

## Deliverables & Changes

| Component | File | Description |
|---|---|---|
| **Core Engine** | [`src/living-places.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/src/living-places.mjs) | Complete dual-subsystem engine (817 lines): types, schemas, generators, reducers, assertions. |
| **Upgrade Engine** | [`src/living-places-upgrade.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/src/living-places-upgrade.mjs) | Prospective offline upgrade (`v26` $\rightarrow$ `v27`) with SHA-256 backup, atomic JSON/SQLite transactions, idempotence. |
| **CLI Runner** | [`scripts/upgrade-living-places.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/scripts/upgrade-living-places.mjs) | CLI runner for upgrading SQLite instances. |
| **Runbook** | [`LIVING-PLACES-V27-LIVE-UPGRADE.md`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/LIVING-PLACES-V27-LIVE-UPGRADE.md) | Operational upgrade checklist and deployment runbook. |
| **Harness & Acceptance** | [`scripts/run-addon4-acceptance.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/scripts/run-addon4-acceptance.mjs) | Multi-seed 30d/90d acceptance harness and goldens verifier. |
| **Acceptance Output** | [`ADDON4-ACCEPTANCE.md`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/ADDON4-ACCEPTANCE.md), [`ADDON4-ACCEPTANCE.json`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/ADDON4-ACCEPTANCE.json) | Audit proof and census reports. |
| **Test Suites** | [`test/living-places.test.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/test/living-places.test.mjs) | 11 comprehensive unit tests for invariants, natural recovery, remediation, and protests. |
| **Upgrade Tests** | [`test/living-places-upgrade.test.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/test/living-places-upgrade.test.mjs), [`cloudflare/test/living-places-v27-upgrade-identity.test.mjs`](file:///c:/Users/chris/Desktop/SilverClouds_Project/site/The-secrets-of-Silver-Clouds/worldstream-server/cloudflare/test/living-places-v27-upgrade-identity.test.mjs) | Offline and Cloudflare DO upgrade identity tests. |

---

## Verification & Acceptance Results

### 1. Multi-Seed Acceptance Summary (`ADDON4-ACCEPTANCE.md`)

- **Determinism**: One-shot == chunked across all seeds (`silver-clouds-now-v1`, `seed-beta`, `seed-gamma`) for 30d and 90d (PASS).
- **Restart Equivalence**: Mid-point checkpoint and restart produces identical digest (PASS).
- **Observer Schedule Invariance**: 6h observation chunking produces identical history digest (PASS).
- **Natural Cadence & Zero Disturbance**:
  - Natural site impacts: 0 across all seeds (natural volume is 0).
  - Onari notices: 0 across all seeds.
  - MEU opened / Legion referrals / Ordinary cadence (meals, practices, sleep, travel) match canonical goldens perfectly.
- **Production Path Spies**: 0 model calls, 0 request-time authoring, 0 refill reservations.
- **Reservoir Goldens**:
  - Active scenes: 874
  - Active quips: 673
  - Inactive production rows: 91
  - Future simulation inactive: 200 (including 30 `future.duskkin` and 30 `future.onari`)
  - 0 future scenes or forbidden families leaked into the active catalog.
- **Synthetic Lifecycle Proof**:
  - Natural recovery: `disturbed` $\rightarrow$ `recovering` $\rightarrow$ `stable` (minor ~7 days).
  - Onari remediation: expedited recovery within 72 hours.
  - Peaceful protest: unresolved consultation $\rightarrow$ protest $\rightarrow$ remediation $\rightarrow$ expedited recovery.
  - Yukon optionality: behaves identically with Yukon awake/available or absent/asleep.

### 2. Full Test Suite Status

- `test/*upgrade*.test.mjs`: 28/28 passing (100%).
- `cloudflare/test/*.test.mjs`: 36/36 passing (100%).
- `test/*.test.mjs`: 892/892 passing (100%).

---

## Release Status & Guardrails

- **Live World**: Pinned to v23. Nothing deployed or pushed.
- **Boundary**: Addon 4 completes the world-memory and ecological recovery layer.
- **Next Steps**: Execution stopped as requested (no Faction Crossings / Addon 5).

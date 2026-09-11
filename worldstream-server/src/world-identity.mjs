export function fixtureIdentity(fixture, version = fixture.rulesVersion) {
  return `fixture:${JSON.stringify([
    fixture.worldId, version, fixture.startMs, fixture.endMs, fixture.maxActions,
  ])}`;
}

// Node pinned worlds persist the full fixture identity. Cloudflare Durable
// Objects created before v24 wrote only the bare RULES_VERSION string.
export function matchesRulesIdentity(rulesVersion, fixture, version = fixture.rulesVersion) {
  return rulesVersion === fixtureIdentity(fixture, version) || rulesVersion === version;
}

export function savedEpochStartMs(stateJson) {
  const saved = typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson;
  if (!Number.isSafeInteger(saved?.meta?.startMs)) throw new Error('World epoch is missing');
  return saved.meta.startMs;
}

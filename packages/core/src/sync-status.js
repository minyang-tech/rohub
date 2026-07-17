const SYNC_STATES = Object.freeze({
  CLEAN: "clean",
  LOCAL_AHEAD: "local-ahead",
  REMOTE_AHEAD: "remote-ahead",
  DIVERGED: "diverged",
  MISSING_LOCAL: "missing-local",
  MISSING_REMOTE: "missing-remote",
  NO_BASE: "no-base",
});

function normalizeHash(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
}

function calculateSyncState({ localHash, remoteHash, baseHash } = {}) {
  const local = normalizeHash(localHash);
  const remote = normalizeHash(remoteHash);
  const base = normalizeHash(baseHash);

  if (!local && !remote) return SYNC_STATES.NO_BASE;
  if (!local) return SYNC_STATES.MISSING_LOCAL;
  if (!remote) return SYNC_STATES.MISSING_REMOTE;
  if (local === remote) return SYNC_STATES.CLEAN;
  if (!base) return SYNC_STATES.DIVERGED;
  if (local !== base && remote === base) return SYNC_STATES.LOCAL_AHEAD;
  if (local === base && remote !== base) return SYNC_STATES.REMOTE_AHEAD;
  return SYNC_STATES.DIVERGED;
}

module.exports = { SYNC_STATES, calculateSyncState };
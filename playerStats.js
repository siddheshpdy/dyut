export const PLAYER_STAT_MODES = Object.freeze(['offline', 'online', 'friends']);

export const PLAYER_STAT_MODE_LABELS = Object.freeze({
  offline: 'Offline',
  online: 'Online Match',
  friends: 'Vs Friends',
});

export const getMatchStatMode = ({ isOnline = false, isPublic = false } = {}) => {
  if (!isOnline) return 'offline';
  return isPublic ? 'online' : 'friends';
};

const normalizeCount = (value) => Math.max(0, Number(value) || 0);

export const createEmptyPlayerModeStats = () => Object.fromEntries(
  PLAYER_STAT_MODES.map((mode) => [mode, { gamesPlayed: 0, wins: 0 }]),
);

export const normalizePlayerModeStats = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    PLAYER_STAT_MODES.map((mode) => [mode, {
      gamesPlayed: normalizeCount(source[mode]?.gamesPlayed),
      wins: normalizeCount(source[mode]?.wins),
    }]),
  );
};

export const normalizePlayerStats = (value = {}) => ({
  ...value,
  gamesPlayed: normalizeCount(value.gamesPlayed),
  wins: normalizeCount(value.wins),
  modeStats: normalizePlayerModeStats(value.modeStats),
});

export const mergePlayerModeStats = (...values) => values.reduce((merged, value) => {
  const normalized = normalizePlayerModeStats(value);
  PLAYER_STAT_MODES.forEach((mode) => {
    merged[mode].gamesPlayed += normalized[mode].gamesPlayed;
    merged[mode].wins += normalized[mode].wins;
  });
  return merged;
}, createEmptyPlayerModeStats());

export const getPlayerModeStats = (stats, mode) => {
  const normalized = normalizePlayerModeStats(stats?.modeStats);
  return normalized[mode] || normalized.offline;
};

import { calculateMatchCoins, normalizeOwnedPieceSkinIds } from './economy';

export const MATCH_COMPLETION_XP = 25;
export const MATCH_WIN_XP = 75;

export function calculateMatchXp({ isWin = false } = {}) {
  return MATCH_COMPLETION_XP + (isWin ? MATCH_WIN_XP : 0);
}

export function getXpForLevel(level) {
  const normalizedLevel = Math.max(1, Number.isInteger(level) ? level : 1);
  let totalXp = 0;
  for (let currentLevel = 1; currentLevel < normalizedLevel; currentLevel += 1) {
    totalXp += 100 + ((currentLevel - 1) * 50);
  }
  return totalXp;
}

export function getLevelForXp(xp) {
  const normalizedXp = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (normalizedXp >= getXpForLevel(level + 1)) level += 1;
  return level;
}

export function createProgressionUpdate(stats = {}, { isWin = false, matchId } = {}) {
  const completedMatchIds = Array.isArray(stats.completedMatchIds) ? stats.completedMatchIds : [];
  if (matchId && completedMatchIds.includes(matchId)) return null;

  const xp = Math.max(0, Number(stats.xp) || 0) + calculateMatchXp({ isWin });
  return {
    gamesPlayed: (Number(stats.gamesPlayed) || 0) + 1,
    wins: (Number(stats.wins) || 0) + (isWin ? 1 : 0),
    xp,
    level: getLevelForXp(xp),
    coins: Math.max(0, Number(stats.coins) || 0) + calculateMatchCoins({ isWin }),
    ownedPieceSkinIds: normalizeOwnedPieceSkinIds(stats.ownedPieceSkinIds),
    ...(matchId ? { completedMatchIds: [...completedMatchIds, matchId].slice(-50) } : {})
  };
}

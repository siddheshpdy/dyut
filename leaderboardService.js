import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebaseSetup.js';
import { getPlayerModeStats, normalizePlayerStats } from './playerStats.js';

const getLeaderboardOrderField = (mode) => (
  mode === 'total' ? 'wins' : `modeStats.${mode}.wins`
);

export const loadWebsiteLeaderboard = async ({ mode = 'total', limitCount = 10 } = {}) => {
  if (!db) return [];

  const safeLimit = Math.min(50, Math.max(1, Number(limitCount) || 10));
  const snapshot = await getDocs(query(
    collection(db, 'leaderboardEntries'),
    orderBy(getLeaderboardOrderField(mode), 'desc'),
    limit(safeLimit),
  ));

  return snapshot.docs.map((userDoc, index) => {
    const stats = normalizePlayerStats(userDoc.data());
    const modeStats = mode === 'total'
      ? { gamesPlayed: stats.gamesPlayed, wins: stats.wins }
      : getPlayerModeStats(stats, mode);

    return {
      rank: index + 1,
      userId: userDoc.id,
      displayName: stats.displayName || 'Player',
      photoURL: stats.photoURL || null,
      gamesPlayed: modeStats.gamesPlayed,
      wins: modeStats.wins,
    };
  });
};

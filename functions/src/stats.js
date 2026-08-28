import { getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FUNCTION_REGION } from './config.js';
import { rejectIfAppCheckMissing, requireAuth, requireObject } from './errors.js';

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const rtdb = getDatabase();

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 160) throw new HttpsError('invalid-argument', `${field} must be a non-empty string.`);
  return value.trim();
}

export async function recordAuthoritativeCompletion({ gameId, uid, game }) {
  if (!game || game.serverAuthority !== true || game.status !== 'finished' || !game.winnerPlayerId) {
    throw new HttpsError('failed-precondition', 'The game has not completed authoritatively.');
  }
  const playerId = Object.entries(game.playerUids || {}).find(([, playerUid]) => playerUid === uid)?.[0];
  if (!playerId || !game.players?.[playerId]) throw new HttpsError('permission-denied', 'You did not participate in this game.');
  const mode = game.isPublic ? 'online' : 'friends';
  const didWin = game.isTeamMode
    ? game.players[playerId].team === game.players[game.winnerPlayerId]?.team
    : playerId === game.winnerPlayerId;
  const completionId = `${gameId}_${uid}`;
  const completionRef = db.collection('matchCompletions').doc(completionId);
  const userRef = db.collection('users').doc(uid);
  const leaderboardRef = db.collection('leaderboardEntries').doc(uid);
  let applied = false;
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(completionRef);
    if (existing.exists) return;
    const userSnapshot = await transaction.get(userRef);
    const existingUser = userSnapshot.exists ? userSnapshot.data() : {};
    const currentModeStats = existingUser.modeStats?.[mode] || { gamesPlayed: 0, wins: 0 };
    const currentModeGames = Number(currentModeStats.gamesPlayed) || 0;
    const currentModeWins = Number(currentModeStats.wins) || 0;
    const nextGamesPlayed = (Number(existingUser.gamesPlayed) || 0) + 1;
    const nextWins = (Number(existingUser.wins) || 0) + (didWin ? 1 : 0);
    const existingModeStatsMap = existingUser.modeStats && typeof existingUser.modeStats === 'object' && !Array.isArray(existingUser.modeStats)
      ? existingUser.modeStats
      : {};
    const nextModeStats = {
      ...existingModeStatsMap,
      [mode]: {
        ...currentModeStats,
        gamesPlayed: currentModeGames + 1,
        wins: currentModeWins + (didWin ? 1 : 0),
      },
    };
    transaction.set(completionRef, { gameId, uid, mode, didWin, createdAt: new Date() });
    transaction.set(userRef, {
      gamesPlayed: FieldValue.increment(1),
      ...(didWin ? { wins: FieldValue.increment(1) } : {}),
      modeStats: nextModeStats,
    }, { merge: true });
    transaction.set(leaderboardRef, {
      uid,
      displayName: typeof existingUser.displayName === 'string' && existingUser.displayName.trim() ? existingUser.displayName.trim().slice(0, 40) : 'Player',
      photoURL: typeof existingUser.photoURL === 'string' ? existingUser.photoURL : null,
      gamesPlayed: nextGamesPlayed,
      wins: nextWins,
      modeStats: nextModeStats,
      updatedAt: new Date(),
    }, { merge: true });
    applied = true;
  });
  return { applied, gameId, mode, didWin };
}

export const recordMatchCompletion = onCall({
  region: FUNCTION_REGION,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
}, async (request) => {
  try {
    rejectIfAppCheckMissing(request);
    const uid = requireAuth(request);
    requireObject(request.data, 'data');
    const gameId = requireString(request.data.gameId, 'gameId');
    const gameSnapshot = await rtdb.ref(`games/${gameId}`).get();
    if (!gameSnapshot.exists()) throw new HttpsError('not-found', 'The completed game could not be found.');
    return await recordAuthoritativeCompletion({ gameId, uid, game: gameSnapshot.val() });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Failed to record authoritative match completion:', error);
    throw new HttpsError('internal', 'Match completion could not be recorded.');
  }
});

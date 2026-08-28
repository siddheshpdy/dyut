import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FUNCTION_REGION } from '../config.js';
import { adminApp } from '../firebaseAdmin.js';
import { rejectIfAppCheckMissing, requireAuth, requireObject } from '../errors.js';
import {
  EconomyCommandError,
  applyDailyLoginReward,
  claimGoalReward as applyClaimGoalReward,
  normalizeEconomyState,
  purchasePieceSkin as applyPieceSkinPurchase,
  recordOnlineGoalProgress,
  refundPublicMatchEntry as applyPublicMatchRefund,
  reservePublicMatchEntry as applyPublicMatchEntry,
  settlePublicMatch as applyPublicMatchSettlement,
} from '../shared/economy.js';

const db = getFirestore(adminApp);
const rtdb = getDatabase(adminApp);
const OPTIONS = { region: FUNCTION_REGION, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };

function stringValue(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 160) throw new HttpsError('invalid-argument', `${field} must be a non-empty string.`);
  return value.trim();
}

function mapError(error) {
  if (error instanceof HttpsError) return error;
  if (error instanceof EconomyCommandError) return new HttpsError(error.code, error.message);
  console.error('Economy command failed:', error);
  return new HttpsError('internal', 'The economy operation could not be completed.');
}

export async function mutateWallet(uid, operation) {
  const walletRef = db.collection('wallets').doc(uid);
  let commandResult;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(walletRef);
    const result = operation(normalizeEconomyState(snapshot.exists ? snapshot.data() : {}));
    commandResult = result;
    if (!result.applied && snapshot.exists) return;
    transaction.set(walletRef, result.state, { merge: true });
    if (result.applied && result.event) {
      const ledgerRef = db.collection('walletLedger').doc(`${uid}_${result.eventId}`);
      transaction.set(ledgerRef, { uid, eventId: result.eventId, ...result.event, createdAt: Number(result.event.createdAt) || Date.now() }, { merge: false });
    }
  });
  return commandResult;
}

function getActiveHumanEntries(game) {
  // A disconnected human seat is marked as a bot for turn control, but its
  // UID remains attached to the game so its paid entry, loss, and completion
  // projection cannot disappear from the settlement pool.
  return Object.entries(game?.playerUids || {}).filter(([, uid]) => uid);
}

function getCompletionOutcome(game, playerId) {
  const winnerPlayerId = game.winnerPlayerId;
  const didWin = Boolean(winnerPlayerId) && (game.isTeamMode
    ? game.players[playerId]?.team === game.players[winnerPlayerId]?.team
    : playerId === winnerPlayerId);
  return { didWin, isDraw: !winnerPlayerId };
}

export async function recordAuthoritativeEconomy({ matchId, game }) {
  if (!game || game.serverAuthority !== true || game.status !== 'finished' || !game.winnerPlayerId) {
    throw new HttpsError('failed-precondition', 'The game has not completed authoritatively.');
  }
  const paidPlayers = getActiveHumanEntries(game);
  const winnerPlayerId = game.winnerPlayerId;
  const winnerCount = game.isTeamMode && winnerPlayerId
    ? new Set(paidPlayers
      .filter(([id]) => game.players[id]?.team === game.players[winnerPlayerId]?.team)
      .map(([, uid]) => uid)).size
    : 1;
  const results = [];
  for (const [playerId, uid] of paidPlayers) {
    const { didWin, isDraw } = getCompletionOutcome(game, playerId);
    const goal = await mutateWallet(uid, (state) => recordOnlineGoalProgress(state, {
      matchId,
      didWin,
      captures: game.players[playerId]?.captureCount || 0,
    }));
    const settlement = game.isPublic
      ? await mutateWallet(uid, (state) => applyPublicMatchSettlement(state, {
        matchId,
        participantCount: paidPlayers.length,
        didWin,
        isDraw,
        winnerCount: Math.max(1, winnerCount),
      }))
      : null;
    results.push({ uid, goal, settlement });
  }
  return { matchId, results };
}

function withAuth(handler) {
  return onCall(OPTIONS, async (request) => {
    try {
      rejectIfAppCheckMissing(request);
      const uid = requireAuth(request);
      return await handler(request, uid);
    } catch (error) {
      throw mapError(error);
    }
  });
}

export const getEconomyState = withAuth(async (_request, uid) => {
  const snapshot = await db.collection('wallets').doc(uid).get();
  return { state: normalizeEconomyState(snapshot.exists ? snapshot.data() : {}) };
});

export const claimDailyReward = withAuth(async (_request, uid) => mutateWallet(uid, (state) => applyDailyLoginReward(state)));

export const recordGoalProgress = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const matchId = stringValue(request.data.matchId, 'matchId');
  const snapshot = await rtdb.ref(`games/${matchId}`).get();
  if (!snapshot.exists()) throw new HttpsError('not-found', 'The completed game could not be found.');
  const game = snapshot.val();
  if (game.serverAuthority !== true || game.status !== 'finished' || !game.winnerPlayerId) throw new HttpsError('failed-precondition', 'The game has not completed authoritatively.');
  const playerId = Object.entries(game.playerUids || {}).find(([, playerUid]) => playerUid === uid)?.[0];
  if (!playerId) throw new HttpsError('permission-denied', 'You did not participate in this game.');
  const { didWin } = getCompletionOutcome(game, playerId);
  return mutateWallet(uid, (state) => recordOnlineGoalProgress(state, {
    matchId, didWin, captures: game.players[playerId]?.captureCount || 0,
  }));
});

export const claimGoalReward = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  return mutateWallet(uid, (state) => applyClaimGoalReward(state, { goalId: stringValue(request.data.goalId, 'goalId') }));
});

export const claimRewardMultiplier = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  // The current ad providers only report completion to the browser. Until a
  // provider webhook or signed server-verifiable proof is configured, fail
  // closed rather than treating a browser-supplied proof as authoritative.
  throw new HttpsError('failed-precondition', 'Rewarded ad verification is not configured.');
});

export const purchasePieceSkin = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  return mutateWallet(uid, (state) => applyPieceSkinPurchase(state, stringValue(request.data.pieceSkinId, 'pieceSkinId')));
});

export const reservePublicMatchEntry = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const matchId = stringValue(request.data.matchId, 'matchId');
  const lobbySnapshot = await rtdb.ref(`lobbies/${matchId}`).get();
  const lobby = lobbySnapshot.exists() ? lobbySnapshot.val() : null;
  const isParticipant = Object.values(lobby?.seats || {}).some((seat) => seat?.uid === uid);
  if (!lobby || lobby.serverAuthority !== true || lobby.isPublic !== true || !['waiting', 'starting'].includes(lobby.status)) {
    throw new HttpsError('failed-precondition', 'This is not an active public match lobby.');
  }
  if (!isParticipant) throw new HttpsError('permission-denied', 'You must claim a seat before reserving an entry.');
  return mutateWallet(uid, (state) => applyPublicMatchEntry(state, matchId));
});

export const settlePublicMatch = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const matchId = stringValue(request.data.matchId, 'matchId');
  const snapshot = await rtdb.ref(`games/${matchId}`).get();
  if (!snapshot.exists()) throw new HttpsError('not-found', 'The public game was not found.');
  const game = snapshot.val();
  if (game.serverAuthority !== true || game.status !== 'finished' || game.isPublic !== true) throw new HttpsError('failed-precondition', 'The public game is not complete.');
  const playerId = Object.entries(game.playerUids || {}).find(([, playerUid]) => playerUid === uid)?.[0];
  if (!playerId) throw new HttpsError('permission-denied', 'You did not participate in this public game.');
  const paidPlayerIds = getActiveHumanEntries(game);
  const { didWin, isDraw } = getCompletionOutcome(game, playerId);
  const winnerCount = game.isTeamMode && game.winnerPlayerId
    ? new Set(paidPlayerIds.filter(([id]) => game.players[id]?.team === game.players[game.winnerPlayerId]?.team).map(([, playerUid]) => playerUid)).size
    : 1;
  return mutateWallet(uid, (state) => applyPublicMatchSettlement(state, {
    matchId,
    participantCount: paidPlayerIds.length,
    didWin,
    isDraw,
    winnerCount: Math.max(1, winnerCount),
  }));
});

export const refundPublicMatchEntry = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const matchId = stringValue(request.data.matchId, 'matchId');
  const lobbySnapshot = await rtdb.ref(`lobbies/${matchId}`).get();
  const lobby = lobbySnapshot.exists() ? lobbySnapshot.val() : null;
  if (!lobby || lobby.serverAuthority !== true || lobby.isPublic !== true || !['waiting', 'starting'].includes(lobby.status)) {
    throw new HttpsError('failed-precondition', 'This public entry is no longer refundable.');
  }
  const isParticipant = Object.values(lobby.seats || {}).some((seat) => seat?.uid === uid);
  if (!isParticipant) throw new HttpsError('permission-denied', 'You did not participate in this public match.');
  return mutateWallet(uid, (state) => applyPublicMatchRefund(state, matchId, request.data.reason || 'match_not_started'));
});

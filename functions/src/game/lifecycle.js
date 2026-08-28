import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FUNCTION_REGION } from '../config.js';
import { adminApp } from '../firebaseAdmin.js';
import { rejectIfAppCheckMissing, requireAuth, requireObject } from '../errors.js';
import { isKnownPieceSkinId, isPieceSkinOwned } from '../shared/economy.js';

const rtdb = getDatabase(adminApp);
const db = getFirestore(adminApp);
const OPTIONS = { region: FUNCTION_REGION, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };
const SEAT_IDS = ['Player1', 'Player2', 'Player3', 'Player4'];

function stringValue(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) throw new HttpsError('invalid-argument', `${field} must be a non-empty string.`);
  return value.trim();
}

function mapError(error) {
  if (error instanceof HttpsError) return error;
  console.error('Game lifecycle command failed:', error);
  return new HttpsError('internal', 'The game lifecycle operation could not be completed.');
}

function withAuth(handler) {
  return onCall(OPTIONS, async (request) => {
    try {
      rejectIfAppCheckMissing(request);
      return await handler(request, requireAuth(request));
    } catch (error) {
      throw mapError(error);
    }
  });
}

async function loadOwnedPieceSkins(lobby) {
  const entries = Object.entries(lobby.seats || {}).filter(([, seat]) => seat.type === 'human' && seat.uid);
  const snapshots = await Promise.all(entries.map(([playerId, seat]) => db.collection('wallets').doc(seat.uid).get().then((snapshot) => [playerId, snapshot])));
  return new Map(snapshots.map(([playerId, snapshot]) => [
    playerId,
    snapshot.exists ? snapshot.data()?.ownedPieceSkinIds : [],
  ]));
}

async function buildPlayers(lobby, initialPiecePathIndex) {
  const active = SEAT_IDS.filter((id) => lobby.seats?.[id]?.type !== 'closed');
  const teamMode = Boolean(lobby.isTeamMode);
  const ownedPieceSkins = await loadOwnedPieceSkins(lobby);
  const players = {};
  for (const [index, playerId] of active.entries()) {
    const seat = lobby.seats[playerId];
    const playerNumber = Number(playerId.replace('Player', ''));
    const requestedPieceSkinId = typeof seat.pieceSkinId === 'string' ? seat.pieceSkinId : 'classic';
    const pieceSkinId = seat.type === 'human'
      ? (isPieceSkinOwned(requestedPieceSkinId, ownedPieceSkins.get(playerId)) ? requestedPieceSkinId : 'classic')
      : (isKnownPieceSkinId(requestedPieceSkinId) ? requestedPieceSkinId : 'classic');
    players[playerId] = {
      color: seat.color,
      pieceSkinId,
      name: seat.name || (seat.type === 'bot' ? `Bot ${playerNumber}` : `Player ${playerNumber}`),
      hasKilled: false,
      captureCount: 0,
      pieces: Number.isInteger(initialPiecePathIndex) ? [initialPiecePathIndex, -1, -1, -1] : [-1, -1, -1, -1],
      team: teamMode ? (playerNumber % 2 !== 0 ? 1 : 2) : 0,
      seatIndex: index,
    };
  }
  return players;
}

export const initializeGame = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const gameId = stringValue(request.data.gameId, 'gameId');
  const lobbySnapshot = await rtdb.ref(`lobbies/${gameId}`).get();
  if (!lobbySnapshot.exists()) throw new HttpsError('not-found', 'The lobby no longer exists.');
  const lobby = lobbySnapshot.val();
  if (lobby.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
  if (lobby.hostUid !== uid || lobby.status !== 'playing') throw new HttpsError('permission-denied', 'Only the active lobby host can initialize the game.');
  const gameRef = rtdb.ref(`games/${gameId}`);
  const requestedInitialPiecePathIndex = request.data.initialPiecePathIndex;
  const initialPiecePathIndex = requestedInitialPiecePathIndex === null || requestedInitialPiecePathIndex === undefined
    ? null
    : Number(requestedInitialPiecePathIndex);
  if (initialPiecePathIndex !== null && initialPiecePathIndex !== 2) {
    throw new HttpsError('invalid-argument', 'The online initial piece position is fixed.');
  }
  const players = await buildPlayers(lobby, initialPiecePathIndex);
  const playerUids = Object.fromEntries(Object.entries(lobby.seats || {}).filter(([, seat]) => seat.type !== 'closed').map(([id, seat]) => [id, seat.uid || null]));
  if (Object.values(playerUids).filter(Boolean).length < 2) throw new HttpsError('failed-precondition', 'At least two human players are required.');
  const state = {
    currentPlayer: Object.keys(players)[0],
    turnQueue: [],
    turnHistory: [],
    players,
    boardOccupancy: {},
    playerUids,
    bots: Object.entries(lobby.seats || {}).filter(([, seat]) => seat.type === 'bot').map(([id]) => id),
    botDifficulty: lobby.botDifficulty || 'easy',
    isVoidRuleEnabled: lobby.isVoidRuleEnabled !== false,
    isQuickGame: Boolean(lobby.isQuickGame),
    isTeamMode: Boolean(lobby.isTeamMode),
    hasRolledThisTurn: false,
    rollingPhaseComplete: false,
    isOnline: true,
    gameId,
    hostUid: uid,
    isPublic: Boolean(lobby.isPublic),
    serverAuthority: lobby.serverAuthority === true,
    initialPiecePathIndex,
    status: 'playing',
    lastPing: Date.now(),
    turnStartedAt: Date.now(),
    lastActionTime: Date.now(),
    afkStrikes: {},
    isAfkTurn: false,
    version: 0,
  };
  const result = await gameRef.transaction((current) => current || state);
  return { state: result.snapshot.val(), created: result.committed && !result.snapshot.val()?.lastActionId };
});

export const heartbeatGame = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const gameId = stringValue(request.data.gameId, 'gameId');
  const gameRef = rtdb.ref(`games/${gameId}`);
  const snapshot = await gameRef.get();
  if (!snapshot.exists() || snapshot.val().serverAuthority !== true || snapshot.val().hostUid !== uid) throw new HttpsError('permission-denied', 'Only the server-authoritative game host can heartbeat the game.');
  await gameRef.update({ lastPing: Date.now() });
  return { ok: true };
});

export const recoverGameHost = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const gameId = stringValue(request.data.gameId, 'gameId');
  const gameRef = rtdb.ref(`games/${gameId}`);
  let recovered = false;
  let resultState;
  let commandError = null;
  const result = await gameRef.transaction((current) => {
    if (!current) return current;
    try {
      if (current.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This game is not managed by server authority.');
      if (current.hostUid === uid || Date.now() - Number(current.lastPing || 0) <= 25000) return current;
      const activeHumans = Object.entries(current.playerUids || {}).filter(([id, playerUid]) => playerUid && !(current.bots || []).includes(id)).sort(([left], [right]) => left.localeCompare(right));
      if (!activeHumans.length || activeHumans[0][1] !== uid) return current;
      recovered = true;
      const previousHostPlayerId = Object.entries(current.playerUids || {})
        .find(([, playerUid]) => playerUid === current.hostUid)?.[0];
      resultState = {
        ...current,
        hostUid: uid,
        bots: [...new Set([...(current.bots || []), previousHostPlayerId].filter(Boolean))],
        lastPing: Date.now(),
      };
      return resultState;
    } catch (error) {
      commandError = error;
      return current;
    }
  });
  if (commandError) throw commandError;
  if (!result.snapshot.exists()) throw new HttpsError('not-found', 'Game not found.');
  return { recovered, state: resultState || null };
});

export const leaveGame = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const gameId = stringValue(request.data.gameId, 'gameId');
  const gameRef = rtdb.ref(`games/${gameId}`);
  let shouldRemove = false;
  let resultState;
  let commandError = null;
  const transactionResult = await gameRef.transaction((current) => {
    if (!current) return current;
    if (current.serverAuthority !== true) {
      commandError = new HttpsError('failed-precondition', 'This game is not managed by server authority.');
      return current;
    }
    const playerId = Object.entries(current.playerUids || {}).find(([, playerUid]) => playerUid === uid)?.[0];
    if (!playerId) {
      commandError = new HttpsError('permission-denied', 'You did not participate in this game.');
      return current;
    }
    // Once the authoritative completion trigger has been queued, a later
    // disconnect must not delete or mutate the finished record before stats
    // and public settlement are projected.
    if (current.status === 'finished') return current;
    const bots = [...new Set([...(current.bots || []), playerId])];
    const remaining = Object.entries(current.playerUids || {}).filter(([id, playerUid]) => playerUid && playerUid !== uid && !bots.includes(id));
    if (!remaining.length) {
      shouldRemove = true;
      return null;
    }
    const nextHostUid = current.hostUid === uid ? remaining.sort(([left], [right]) => left.localeCompare(right))[0][1] : current.hostUid;
    resultState = {
      ...current,
      bots,
      hostUid: nextHostUid,
      ...(remaining.length < 2 ? { status: 'finished', winnerPlayerId: remaining[0][0] } : {}),
      lastActionAt: Date.now(),
    };
    return resultState;
  });
  if (commandError) throw commandError;
  if (!transactionResult.snapshot.exists() && !shouldRemove) throw new HttpsError('not-found', 'Game not found.');
  if (shouldRemove) {
    await gameRef.remove();
    await rtdb.ref(`lobbies/${gameId}`).remove();
  }
  return { ok: true, state: resultState || null };
});

export const finalizeGame = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const gameId = stringValue(request.data.gameId, 'gameId');
  const gameRef = rtdb.ref(`games/${gameId}`);
  const snapshot = await gameRef.get();
  if (!snapshot.exists() || snapshot.val().serverAuthority !== true || snapshot.val().hostUid !== uid) throw new HttpsError('permission-denied', 'Only the server-authoritative game host can finalize this game.');
  if (snapshot.val().status !== 'finished') throw new HttpsError('failed-precondition', 'The game is not finished.');
  await gameRef.update({ finalizedAt: Date.now() });
  await rtdb.ref(`lobbies/${gameId}`).remove();
  return { ok: true };
});

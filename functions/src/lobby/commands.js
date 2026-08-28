import { randomBytes } from 'node:crypto';
import { getDatabase } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FUNCTION_REGION } from '../config.js';
import { adminApp } from '../firebaseAdmin.js';
import { rejectIfAppCheckMissing, requireAuth, requireObject } from '../errors.js';
import { SEAT_IDS, openSeatCount, sanitizeSeats, validateSeatId } from './sanitization.js';
import { mutateWallet } from '../economy/commands.js';
import { reservePublicMatchEntry, refundPublicMatchEntry } from '../shared/economy.js';

const rtdb = getDatabase(adminApp);
const OPTIONS = { region: FUNCTION_REGION, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };

function stringValue(value, field, max = 160) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw new HttpsError('invalid-argument', `${field} must be a non-empty string.`);
  return value.trim();
}

function safeName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}

function createLobbyId() {
  return randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

function mapError(error) {
  if (error instanceof HttpsError) return error;
  console.error('Lobby command failed:', error);
  return new HttpsError('internal', 'The lobby operation could not be completed.');
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

export const createLobby = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const requestedSeats = sanitizeSeats(request.data.seats);
  const hostSeatId = SEAT_IDS.find((id) => requestedSeats[id].type === 'human') || 'Player1';
  const seats = Object.fromEntries(SEAT_IDS.map((id) => [id, {
    ...requestedSeats[id],
    ...(id === hostSeatId ? { type: 'human', uid, name: safeName(requestedSeats[id].name) || 'Player 1' } : { uid: null }),
  }]));
  const lobbyId = createLobbyId();
  const record = {
    seats,
    botDifficulty: typeof request.data.botDifficulty === 'string' ? request.data.botDifficulty.slice(0, 20) : 'easy',
    isVoidRuleEnabled: request.data.isVoidRuleEnabled !== false,
    isQuickGame: Boolean(request.data.isQuickGame),
    isTeamMode: Boolean(request.data.isTeamMode),
    hostUid: uid,
    gameStarted: false,
    isPublic: Boolean(request.data.isPublic),
    serverAuthority: true,
    status: 'waiting',
    expiresAt: Number.isFinite(Number(request.data.expiresAt)) ? Number(request.data.expiresAt) : null,
    matchType: typeof request.data.matchType === 'string' ? request.data.matchType.slice(0, 12) : 'ffa',
    version: 3,
    lastPing: Date.now(),
    openSeats: openSeatCount(seats),
    economy: request.data.economy && typeof request.data.economy === 'object' ? request.data.economy : null,
  };
  const result = await rtdb.ref(`lobbies/${lobbyId}`).transaction((current) => current || record);
  if (!result.committed) throw new HttpsError('aborted', 'Could not create the lobby.');
  return { lobbyId, lobby: result.snapshot.val() };
});

export const findPublicLobby = withAuth(async (request) => {
  requireObject(request.data, 'data');
  const snapshot = await rtdb.ref('lobbies').orderByChild('status').equalTo('waiting').limitToFirst(100).get();
  if (!snapshot.exists()) return { lobbyId: null };
  const requested = request.data;
  const candidates = Object.entries(snapshot.val()).filter(([, lobby]) => (
    lobby.isPublic === true
    && lobby.serverAuthority === true
    && lobby.openSeats > 0
    && lobby.matchType === (requested.matchType || 'ffa')
    && Boolean(lobby.isQuickGame) === Boolean(requested.isQuickGame)
    && Boolean(lobby.isTeamMode) === Boolean(requested.isTeamMode)
    && Boolean(lobby.isVoidRuleEnabled) === Boolean(requested.isVoidRuleEnabled)
    && (!lobby.lastPing || Date.now() - lobby.lastPing <= 25000)
  ));
  if (!candidates.length) return { lobbyId: null };
  return { lobbyId: candidates[Math.floor(Math.random() * candidates.length)][0] };
});

// Private invitees cannot read an unclaimed lobby through RTDB rules. This
// authenticated snapshot endpoint lets the lobby UI synchronize by invite ID
// without broadening database reads to every waiting private lobby.
export const getLobby = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const lobbyId = stringValue(request.data.lobbyId, 'lobbyId', 32);
  const snapshot = await rtdb.ref(`lobbies/${lobbyId}`).get();
  if (!snapshot.exists()) throw new HttpsError('not-found', 'Lobby not found.');
  const lobby = snapshot.val();
  const isParticipant = lobby.hostUid === uid || Object.values(lobby.seats || {}).some((seat) => seat?.uid === uid);
  if (!isParticipant && lobby.status !== 'waiting') throw new HttpsError('permission-denied', 'You are not part of this lobby.');
  return { lobby };
});

export const claimLobbySeat = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const lobbyId = stringValue(request.data.lobbyId, 'lobbyId', 32);
  const playerId = validateSeatId(request.data.playerId);
  let response;
  let commandError = null;
  const result = await rtdb.ref(`lobbies/${lobbyId}`).transaction((current) => {
    if (!current) return current;
    try {
      if (current.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
      if (current.status !== 'waiting') throw new HttpsError('failed-precondition', 'Lobby is no longer waiting.');
      const existingOwnedSeat = SEAT_IDS.find((id) => current.seats?.[id]?.uid === uid);
      const target = current.seats?.[playerId];
      if (existingOwnedSeat && existingOwnedSeat !== playerId) throw new HttpsError('already-exists', 'You already claimed a seat.');
      if (!target || (target.uid && target.uid !== uid)) throw new HttpsError('already-exists', 'That seat is already claimed.');
      const seats = { ...current.seats, [playerId]: { ...target, type: 'human', uid, name: safeName(request.data.name) || target.name || 'Player' } };
      response = { seats };
      return { ...current, seats, openSeats: openSeatCount(seats), version: (current.version || 0) + 1 };
    } catch (error) {
      commandError = error;
      return current;
    }
  });
  if (commandError) throw commandError;
  if (!result.snapshot.exists()) throw new HttpsError('not-found', 'Lobby not found.');
  return response;
});

export const updateLobby = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const lobbyId = stringValue(request.data.lobbyId, 'lobbyId', 32);
  const patch = requireObject(request.data.patch, 'patch');
  const allowed = ['seats', 'botDifficulty', 'isVoidRuleEnabled', 'isQuickGame', 'isTeamMode', 'matchType', 'lastPing'];
  if (Object.keys(patch).some((key) => !allowed.includes(key))) throw new HttpsError('invalid-argument', 'Lobby field is not editable.');
  let response;
  let commandError = null;
  const result = await rtdb.ref(`lobbies/${lobbyId}`).transaction((current) => {
    if (!current) return current;
    try {
      if (current.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
      if (current.hostUid !== uid) throw new HttpsError('permission-denied', 'Only the host can update this lobby.');
      if (current.status !== 'waiting') throw new HttpsError('failed-precondition', 'Lobby can only be edited while waiting.');
      const seats = patch.seats ? sanitizeSeats(patch.seats, current.seats) : current.seats;
      response = { ...current, ...patch, seats, openSeats: openSeatCount(seats), version: (current.version || 0) + 1 };
      return response;
    } catch (error) {
      commandError = error;
      return current;
    }
  });
  if (commandError) throw commandError;
  if (!result.snapshot.exists()) throw new HttpsError('not-found', 'Lobby not found.');
  return { lobby: response };
});

export const heartbeatLobby = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const lobbyId = stringValue(request.data.lobbyId, 'lobbyId', 32);
  const snapshot = await rtdb.ref(`lobbies/${lobbyId}`).get();
  if (!snapshot.exists() || snapshot.val().serverAuthority !== true || snapshot.val().hostUid !== uid) throw new HttpsError('permission-denied', 'Only the host can heartbeat this lobby.');
  await rtdb.ref(`lobbies/${lobbyId}`).update({ lastPing: Date.now() });
  return { ok: true };
});

export const startLobby = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const lobbyId = stringValue(request.data.lobbyId, 'lobbyId', 32);
  const lobbyRef = rtdb.ref(`lobbies/${lobbyId}`);
  const initialSnapshot = await lobbyRef.get();
  if (!initialSnapshot.exists()) throw new HttpsError('not-found', 'Lobby not found.');
  const initial = initialSnapshot.val();
  if (initial.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
  if (initial.hostUid !== uid) throw new HttpsError('permission-denied', 'Only the host can start this lobby.');
  if (initial.status !== 'waiting' && initial.status !== 'starting') return { lobby: initial, charged: false };

  // Lock the exact final seat set before reserving any wallet entries. This
  // closes the race where a player could claim a seat after the initial read
  // but before the fee reservation. A previously locked start is resumable:
  // this also covers a process restart between the lock and the reservations.
  let response;
  let startingBaseline;
  let commandError = null;
  if (initial.status === 'starting') {
    response = initial;
    const baselineSeats = initial.startBaselineSeats || initial.seats || {};
    startingBaseline = {
      ...initial,
      seats: baselineSeats,
      status: 'waiting',
      gameStarted: false,
      openSeats: openSeatCount(baselineSeats),
      startBaselineSeats: null,
      startStartedAt: null,
    };
  } else {
    const lockResult = await lobbyRef.transaction((current) => {
      if (!current) return current;
      try {
        if (current.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
        if (current.hostUid !== uid) throw new HttpsError('permission-denied', 'Only the host can start this lobby.');
        if (current.status !== 'waiting') return current;
        // The browser can be behind the latest seat claim when the host
        // presses Start. Always validate the server's current seats so a
        // stale client payload cannot erase a guest's claimed UID.
        const transactionSeats = sanitizeSeats(current.seats, current.seats);
        const transactionActiveSeats = Object.values(transactionSeats).filter((seat) => seat.type !== 'closed');
        const transactionHumans = transactionActiveSeats.filter((seat) => seat.type === 'human' && seat.uid);
        if (transactionActiveSeats.length < 2 || transactionHumans.length < 2) {
          throw new HttpsError('failed-precondition', 'At least two claimed human players are required.');
        }
        startingBaseline = current;
        const transactionFinalSeats = current.isPublic
          ? Object.fromEntries(SEAT_IDS.map((id) => [id, transactionSeats[id].type === 'human' && !transactionSeats[id].uid
            ? { ...transactionSeats[id], type: 'closed' }
            : transactionSeats[id]]))
          : transactionSeats;
        response = {
          ...current,
          seats: transactionFinalSeats,
          status: 'starting',
          gameStarted: false,
          openSeats: 0,
          startBaselineSeats: current.seats,
          startStartedAt: Date.now(),
          version: (current.version || 0) + 1,
        };
        return response;
      } catch (error) {
        commandError = error;
        return current;
      }
    });
    if (commandError) throw commandError;
    if (!lockResult.snapshot.exists()) throw new HttpsError('not-found', 'Lobby not found.');
  }
  if (!response || response.status !== 'starting') {
    const latest = await lobbyRef.get();
    return { lobby: latest.exists() ? latest.val() : null, charged: false };
  }

  const attemptedUids = [];
  const reservedUids = [];

  try {
    if (response.isPublic) {
      const humans = Object.values(response.seats).filter((seat) => seat.type === 'human' && seat.uid);
      for (const playerUid of [...new Set(humans.map((seat) => seat.uid))]) {
        attemptedUids.push(playerUid);
        const result = await mutateWallet(playerUid, (state) => reservePublicMatchEntry(state, lobbyId));
        if (result.applied) reservedUids.push(playerUid);
      }
    }

    let finalResponse;
    commandError = null;
    const transactionResult = await lobbyRef.transaction((current) => {
      if (!current) return current;
      try {
        if (current.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
        if (current.hostUid !== uid) throw new HttpsError('permission-denied', 'Only the host can start this lobby.');
        if (current.status !== 'starting') return current;
        finalResponse = {
          ...current,
          status: 'playing',
          gameStarted: true,
          openSeats: 0,
          startBaselineSeats: null,
          startStartedAt: null,
          version: (current.version || 0) + 1,
        };
        return finalResponse;
      } catch (error) {
        commandError = error;
        return current;
      }
    });
    if (commandError) throw commandError;
    if (!transactionResult.snapshot.exists()) throw new HttpsError('not-found', 'Lobby not found.');
    if (!finalResponse) {
      const latest = await lobbyRef.get();
      finalResponse = latest.exists() ? latest.val() : null;
    }
    if (finalResponse?.status !== 'playing') throw new HttpsError('aborted', 'The lobby changed before it could start.');
    return { lobby: finalResponse, charged: reservedUids.length > 0 };
  } catch (error) {
    // Refund every wallet operation attempted by this start, including an
    // idempotent reservation that may have committed before the process died
    // or the callable lost its response.
    await Promise.allSettled(attemptedUids.map((playerUid) => mutateWallet(playerUid, (state) => refundPublicMatchEntry(state, lobbyId, 'lobby_start_failed'))));
    let rollbackError = null;
    await lobbyRef.transaction((current) => {
      if (!current || current.hostUid !== uid || current.status !== 'starting') return current;
      const baseline = startingBaseline || current;
      return {
        ...baseline,
        status: 'waiting',
        gameStarted: false,
        openSeats: openSeatCount(baseline.seats || {}),
        startBaselineSeats: null,
        startStartedAt: null,
        version: (current.version || 0) + 1,
      };
    }).catch((rollbackFailure) => { rollbackError = rollbackFailure; });
    if (rollbackError) console.error('Unable to roll back failed lobby start.', rollbackError);
    throw error;
  }
});

export const leaveLobby = withAuth(async (request, uid) => {
  requireObject(request.data, 'data');
  const lobbyId = stringValue(request.data.lobbyId, 'lobbyId', 32);
  const lobbyRef = rtdb.ref(`lobbies/${lobbyId}`);
  let shouldRemove = false;
  let commandError = null;
  const result = await lobbyRef.transaction((current) => {
    if (!current) return current;
    try {
      if (current.serverAuthority !== true) throw new HttpsError('failed-precondition', 'This lobby is not managed by server authority.');
      if (current.status !== 'waiting') throw new HttpsError('failed-precondition', 'This lobby can no longer be left.');
      if (current.hostUid === uid) {
        shouldRemove = true;
        return null;
      }
      const seats = Object.fromEntries(SEAT_IDS.map((id) => [id, current.seats?.[id]?.uid === uid ? { ...current.seats[id], uid: null, type: 'human' } : current.seats[id]]));
      return { ...current, seats, openSeats: openSeatCount(seats), version: (current.version || 0) + 1 };
    } catch (error) {
      commandError = error;
      return current;
    }
  });
  if (commandError) throw commandError;
  if (!result.snapshot.exists() && !shouldRemove) throw new HttpsError('not-found', 'Lobby not found.');
  if (shouldRemove) await lobbyRef.remove();
  return { ok: true };
});

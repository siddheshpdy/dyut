import assert from 'node:assert/strict';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

process.env.GCLOUD_PROJECT ||= 'onlinedyut';
process.env.FIREBASE_CONFIG ||= JSON.stringify({
  projectId: 'onlinedyut',
  databaseURL: 'http://127.0.0.1:9000?ns=onlinedyut-default-rtdb',
});
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_DATABASE_EMULATOR_HOST ||= '127.0.0.1:9000';

const integrationApp = getApps().length === 0 ? initializeApp() : getApps()[0];

const database = getDatabase();
const firestore = getFirestore();
const functionsBase = 'http://127.0.0.1:5001/onlinedyut/asia-south1';
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

async function signUp(label) {
  const response = await fetch(`${authBase}/accounts:signUp?key=integration-test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `${label}-${Date.now()}@example.test`,
      password: 'IntegrationPass123!',
      returnSecureToken: true,
    }),
  });
  const payload = await response.json();
  assert.equal(response.ok, true, `Auth emulator signup failed: ${JSON.stringify(payload)}`);
  return { uid: payload.localId, token: payload.idToken };
}

async function callFunction(name, token, data) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || `Callable ${name} failed`);
    error.code = payload.error?.status;
    throw error;
  }
  return payload.data || payload.result;
}

async function expectFunctionError(operation, expectedCode) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function waitFor(description, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function createLobby(token, isPublic) {
  return callFunction('createLobby', token, {
    seats: {
      Player1: { type: 'human', color: 'ruby', name: 'Host' },
      Player2: { type: 'closed', color: 'sapphire', name: '' },
      Player3: { type: 'human', color: 'emerald', name: 'Guest' },
      Player4: { type: 'closed', color: 'amber', name: '' },
    },
    botDifficulty: 'easy',
    isVoidRuleEnabled: true,
    isQuickGame: false,
    isTeamMode: false,
    isPublic,
    matchType: '1v1',
  });
}

async function startGame(host, guest, isPublic) {
  const created = await createLobby(host.token, isPublic);
  const lobbyId = created.lobbyId;
  assert.match(lobbyId, /^[A-Z0-9]{6}$/);
  const createdSnapshot = await database.ref(`lobbies/${lobbyId}`).get();
  assert.equal(createdSnapshot.exists(), true, `Created lobby ${lobbyId} was not readable from the emulator database.`);
  await callFunction('claimLobbySeat', guest.token, {
    lobbyId,
    playerId: 'Player3',
    name: 'Guest',
  });
  await callFunction('startLobby', host.token, { lobbyId });
  await callFunction('initializeGame', host.token, {
    gameId: lobbyId,
    initialPiecePathIndex: 2,
  });
  return lobbyId;
}

async function finishGame(gameId) {
  await database.ref(`games/${gameId}`).update({
    status: 'finished',
    winnerPlayerId: 'Player1',
  });
}

const host = await signUp('host');
const guest = await signUp('guest');

// A profile edit may update identity, but cannot create an unverified ranking
// row before any authoritative completion exists.
await callFunction('updateProfileName', host.token, { displayName: 'Renamed Host' });
assert.equal((await firestore.collection('leaderboardEntries').doc(host.uid).get()).exists, false);

// Authenticated lobby/game flow and server-generated dice.
const privateGameId = await startGame(host, guest, false);
const initialGame = (await database.ref(`games/${privateGameId}`).get()).val();
assert.equal(initialGame.serverAuthority, true);
assert.equal(initialGame.playerUids.Player1, host.uid);
assert.equal(initialGame.playerUids.Player3, guest.uid);
await expectFunctionError(
  () => callFunction('leaveLobby', guest.token, { lobbyId: privateGameId }),
  'FAILED_PRECONDITION',
);

// Legacy client-created records must not be promoted into the authoritative
// lifecycle during a staged rollout.
const legacyLobbyId = 'LEGACY1';
await database.ref(`lobbies/${legacyLobbyId}`).set({
  serverAuthority: false,
  hostUid: host.uid,
  status: 'waiting',
  seats: {
    Player1: { type: 'human', uid: host.uid },
    Player2: { type: 'human', uid: guest.uid },
    Player3: { type: 'closed', uid: null },
    Player4: { type: 'closed', uid: null },
  },
});
await expectFunctionError(
  () => callFunction('startLobby', host.token, { lobbyId: legacyLobbyId }),
  'FAILED_PRECONDITION',
);
await database.ref(`lobbies/${legacyLobbyId}`).remove();

const roll = await callFunction('rollGameDice', host.token, {
  gameId: privateGameId,
  actionId: 'integration-roll-1',
  expectedVersion: initialGame.version,
  playerId: 'Player1',
});
assert.equal(roll.version, initialGame.version + 1);
let rolledGame = (await database.ref(`games/${privateGameId}`).get()).val();
assert.ok(rolledGame, `Rolled authoritative game disappeared: ${JSON.stringify(roll)}`);
assert.ok([1, 3, 4, 6].includes(rolledGame.lastRoll.d1));
assert.ok([1, 3, 4, 6].includes(rolledGame.lastRoll.d2));
let voidAttempts = 0;
assert.ok(Array.isArray(rolledGame.turnQueue), `Authoritative roll omitted turnQueue: ${JSON.stringify(rolledGame)}`);
while (rolledGame.turnQueue.length === 0 && voidAttempts < 8) {
  // The server may legitimately generate the 1+3 Void Rule. Advance the
  // completed turn and obtain a non-void roll before testing move/replay
  // behavior, rather than making the integration test depend on randomness.
  const activePlayerId = rolledGame.currentPlayer;
  const activeToken = activePlayerId === 'Player1' ? host.token : guest.token;
  const endVoidTurn = await callFunction('submitGameAction', activeToken, {
    gameId: privateGameId,
    actionId: `integration-end-after-void-${voidAttempts}`,
    expectedVersion: rolledGame.version,
    action: { type: 'END_TURN', payload: { playerId: activePlayerId } },
  });
  rolledGame = (await database.ref(`games/${privateGameId}`).get()).val();
  const nextPlayerId = rolledGame.currentPlayer;
  const nextToken = nextPlayerId === 'Player1' ? host.token : guest.token;
  const retryRoll = await callFunction('rollGameDice', nextToken, {
    gameId: privateGameId,
    actionId: `integration-roll-after-void-${voidAttempts}`,
    expectedVersion: endVoidTurn.version,
    playerId: nextPlayerId,
  });
  assert.equal(retryRoll.version, endVoidTurn.version + 1);
  rolledGame = (await database.ref(`games/${privateGameId}`).get()).val();
  voidAttempts += 1;
}
assert.notEqual(rolledGame.turnQueue.length, 0, 'The random test sequence produced too many Void rolls.');
assert.equal(rolledGame.turnQueue.length, 1);
assert.ok([1, 3, 4, 6].includes(rolledGame.turnQueue[0].d1));
assert.ok([1, 3, 4, 6].includes(rolledGame.turnQueue[0].d2));

await expectFunctionError(
  () => callFunction('rollGameDice', guest.token, {
    gameId: privateGameId,
    actionId: 'integration-forged-roll',
    expectedVersion: rolledGame.version,
    playerId: 'Player3',
  }),
  'PERMISSION_DENIED',
);

const duplicateRoll = await callFunction('rollGameDice', host.token, {
  gameId: privateGameId,
  actionId: 'integration-roll-1',
  expectedVersion: initialGame.version,
  playerId: 'Player1',
});
assert.equal(duplicateRoll.version, rolledGame.version);
// Advance the game with a separate valid server command, then replay the
// original action. The bounded action cache must return the original result
// instead of treating the delayed retry as a new action or a duplicate move.
await database.ref(`games/${privateGameId}`).update({ turnStartedAt: Date.now() - 60000 });
const afkAction = await callFunction('submitGameAction', host.token, {
  gameId: privateGameId,
  actionId: 'integration-afk-1',
  expectedVersion: rolledGame.version,
  action: { type: 'TRIGGER_AFK_INTERVENTION', payload: { playerId: 'Player1' } },
});
assert.equal(afkAction.version, rolledGame.version + 1);
const delayedDuplicateRoll = await callFunction('rollGameDice', host.token, {
  gameId: privateGameId,
  actionId: 'integration-roll-1',
  expectedVersion: initialGame.version,
  playerId: 'Player1',
});
assert.equal(delayedDuplicateRoll.version, roll.version);
await expectFunctionError(
  () => callFunction('submitGameAction', host.token, {
    gameId: privateGameId,
    actionId: 'integration-stale-action',
    expectedVersion: initialGame.version,
    action: { type: 'END_TURN', payload: { playerId: 'Player1' } },
  }),
  'ABORTED',
);
const directWrite = await fetch(`http://127.0.0.1:9000/games/${privateGameId}.json?ns=onlinedyut-default-rtdb&auth=${host.token}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ forged: true }),
});
await directWrite.text();
assert.equal(directWrite.ok, false, 'Direct authoritative RTDB writes must be denied.');

// Rewards are server-owned and idempotent.
const firstDaily = await callFunction('claimDailyReward', host.token, {});
const secondDaily = await callFunction('claimDailyReward', host.token, {});
assert.equal(firstDaily.applied, true);
assert.equal(secondDaily.applied, false);
assert.equal(secondDaily.state.coins, 500);

// The completion trigger, not a client callback, projects stats and goals.
await finishGame(privateGameId);
await waitFor('private match completion projection', async () => (
  (await firestore.collection('matchCompletions').doc(`${privateGameId}_${host.uid}`).get()).exists
));
await waitFor('guest match completion projection', async () => (
  (await firestore.collection('matchCompletions').doc(`${privateGameId}_${guest.uid}`).get()).exists
));
const hostLeaderboard = await firestore.collection('leaderboardEntries').doc(host.uid).get();
assert.equal(hostLeaderboard.exists, true);
assert.equal(hostLeaderboard.data()?.modeStats?.friends?.gamesPlayed, 1);
const hostWallet = await firestore.collection('wallets').doc(host.uid).get();
assert.equal(hostWallet.data()?.events?.[`goal-progress:${privateGameId}`]?.type, 'goal_progress');

// Public lobby start reserves both entry fees before the game can settle.
await callFunction('claimDailyReward', guest.token, {});
const publicGameId = await startGame(host, guest, true);
const hostAfterEntry = await firestore.collection('wallets').doc(host.uid).get();
const guestAfterEntry = await firestore.collection('wallets').doc(guest.uid).get();
assert.equal(hostAfterEntry.data().coins, 300);
assert.equal(guestAfterEntry.data().coins, 300);
await expectFunctionError(
  () => callFunction('refundPublicMatchEntry', guest.token, { matchId: publicGameId, reason: 'forged-refund' }),
  'FAILED_PRECONDITION',
);

await finishGame(publicGameId);
await waitFor('public match settlement projection', async () => {
  const snapshot = await firestore.collection('wallets').doc(host.uid).get();
  return snapshot.data()?.events?.[`settlement:${publicGameId}`]?.type === 'public_prize';
});
const settledHost = await firestore.collection('wallets').doc(host.uid).get();
const settledGuest = await firestore.collection('wallets').doc(guest.uid).get();
assert.equal(settledHost.data().coins, 660);
assert.equal(settledGuest.data().coins, 300);
const leaderboardAfterPublic = await firestore.collection('leaderboardEntries').doc(host.uid).get();
assert.equal(leaderboardAfterPublic.data()?.modeStats?.friends?.gamesPlayed, 1);
assert.equal(leaderboardAfterPublic.data()?.modeStats?.online?.gamesPlayed, 1);

// A disconnected paid player becomes a bot for turn control, but remains a
// human participant for authoritative forfeit settlement and completion stats.
const forfeitGameId = await startGame(host, guest, true);
const hostBeforeForfeit = await firestore.collection('wallets').doc(host.uid).get();
const guestBeforeForfeit = await firestore.collection('wallets').doc(guest.uid).get();
assert.equal(hostBeforeForfeit.data().coins, 460);
assert.equal(guestBeforeForfeit.data().coins, 100);
await callFunction('leaveGame', guest.token, { gameId: forfeitGameId });
// A second disconnect after completion must not remove the record before the
// trigger has projected the full settlement.
await callFunction('leaveGame', host.token, { gameId: forfeitGameId });
await waitFor('forfeit settlement projection', async () => {
  const snapshot = await firestore.collection('wallets').doc(host.uid).get();
  return snapshot.data()?.events?.[`settlement:${forfeitGameId}`]?.type === 'public_prize';
});
const settledForfeitHost = await firestore.collection('wallets').doc(host.uid).get();
const settledForfeitGuest = await firestore.collection('wallets').doc(guest.uid).get();
assert.equal(settledForfeitHost.data().coins, 820);
assert.equal(settledForfeitGuest.data().coins, 100);
await waitFor('forfeit guest completion projection', async () => (
  (await firestore.collection('matchCompletions').doc(`${forfeitGameId}_${guest.uid}`).get()).exists
));

console.log('Server-authority emulator integration passed.');
await deleteApp(integrationApp);

import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, onValue, ref } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'onlinedyut';
const REGION = process.env.VITE_FUNCTIONS_REGION || 'asia-south1';
const EMULATOR_HOST = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const DATABASE_PORT = Number(process.env.FIREBASE_DATABASE_EMULATOR_PORT || 9000);
const AUTH_PORT = Number(process.env.FIREBASE_AUTH_EMULATOR_PORT || 9099);
const FUNCTIONS_PORT = Number(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001);
const databaseUrl = `http://${EMULATOR_HOST}:${DATABASE_PORT}?ns=${PROJECT_ID}`;

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || 'demo-app-id',
  databaseURL: databaseUrl,
};

function createClient(label) {
  const app = initializeApp(firebaseConfig, label);
  const auth = getAuth(app);
  const database = getDatabase(app, databaseUrl);
  const functions = getFunctions(app, REGION);
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_PORT}`, { disableWarnings: true });
  connectFunctionsEmulator(functions, EMULATOR_HOST, FUNCTIONS_PORT);
  return { app, auth, database, functions };
}

async function call(client, name, data) {
  const response = await httpsCallable(client.functions, name)(data);
  return response.data;
}

function waitForVersion(client, gameId, minimumVersion) {
  return new Promise((resolve, reject) => {
    const gameRef = ref(client.database, `games/${gameId}`);
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${client.app.name} to observe game version ${minimumVersion}.`));
    }, 20000);
    unsubscribe = onValue(gameRef, (snapshot) => {
      const state = snapshot.val();
      if (!state || Number(state.version) < minimumVersion) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(state);
    }, (error) => {
      clearTimeout(timeout);
      unsubscribe();
      reject(new Error(`${client.app.name} could not read ${gameId}: ${error.code || error.message}`));
    });
  });
}

const host = createClient('authority-host');
const guest = createClient('authority-guest');

try {
  await Promise.all([signInAnonymously(host.auth), signInAnonymously(guest.auth)]);
  // The emulator's two isolated client connections use explicit mock tokens;
  // callable requests above still validate the real Auth emulator tokens.
  connectDatabaseEmulator(host.database, EMULATOR_HOST, DATABASE_PORT, {
    mockUserToken: { sub: host.auth.currentUser.uid },
  });
  connectDatabaseEmulator(guest.database, EMULATOR_HOST, DATABASE_PORT, {
    mockUserToken: { sub: guest.auth.currentUser.uid },
  });
  // Ensure the RTDB providers have the same fresh Auth tokens that the
  // callable Functions already accepted before opening protected listeners.
  await Promise.all([
    host.auth.currentUser.getIdToken(true),
    guest.auth.currentUser.getIdToken(true),
  ]);
  const [hostIdentity, guestIdentity] = await Promise.all([
    call(host, 'getServerIdentity', {}),
    call(guest, 'getServerIdentity', {}),
  ]);
  const created = await call(host, 'createLobby', {
    seats: {
      Player1: { type: 'human', color: 'ruby', name: 'Authority Host' },
      Player2: { type: 'closed', color: 'sapphire', name: '' },
      Player3: { type: 'human', color: 'emerald', name: 'Authority Guest' },
      Player4: { type: 'closed', color: 'amber', name: '' },
    },
    botDifficulty: 'easy',
    isVoidRuleEnabled: true,
    isQuickGame: false,
    isTeamMode: false,
    isPublic: false,
    matchType: '1v1',
  });
  const gameId = created.lobbyId;
  assert.equal(created.lobby.hostUid, hostIdentity.uid);
  assert.notEqual(hostIdentity.uid, guestIdentity.uid);

  await call(guest, 'claimLobbySeat', { lobbyId: gameId, playerId: 'Player3', name: 'Authority Guest' });
  await call(host, 'startLobby', { lobbyId: gameId });
  await call(host, 'initializeGame', { gameId, initialPiecePathIndex: 2 });

  const hostSnapshot = waitForVersion(host, gameId, 1);
  const guestSnapshot = waitForVersion(guest, gameId, 1);
  const initial = await call(host, 'rollGameDice', {
    gameId,
    actionId: 'two-client-roll-1',
    expectedVersion: 0,
    playerId: 'Player1',
  });
  assert.equal(initial.version, 1);
  const [hostState, guestState] = await Promise.all([hostSnapshot, guestSnapshot]);
  assert.deepEqual(guestState.turnQueue, hostState.turnQueue);
  assert.equal(guestState.version, hostState.version);
  assert.deepEqual(guestState.players, hostState.players);

  const duplicate = await call(host, 'rollGameDice', {
    gameId,
    actionId: 'two-client-roll-1',
    expectedVersion: 0,
    playerId: 'Player1',
  });
  assert.equal(duplicate.version, 1);
  await assert.rejects(
    call(guest, 'rollGameDice', {
      gameId,
      actionId: 'two-client-forged-roll',
      expectedVersion: 1,
      playerId: 'Player3',
    }),
    (error) => error?.code === 'functions/permission-denied',
  );

  await call(guest, 'leaveGame', { gameId });
  await call(host, 'leaveGame', { gameId });
  console.log('Two-client server-authority emulator smoke passed.');
} finally {
  await Promise.all([deleteApp(host.app), deleteApp(guest.app)]);
}

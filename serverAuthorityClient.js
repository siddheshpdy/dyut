import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseSetup.js';

const isEnabled = import.meta.env.VITE_SERVER_AUTHORITY_ENABLED === 'true';
let functionsInstance = null;
let emulatorConnected = false;

function getClient() {
  if (!app) throw new Error('Firebase is not configured for server-authoritative gameplay.');
  if (!functionsInstance) functionsInstance = getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || 'asia-south1');
  if (!emulatorConnected && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
    emulatorConnected = true;
  }
  return functionsInstance;
}

export const isServerAuthorityEnabled = () => isEnabled && Boolean(app);

export async function rollGameDice({ gameId, actionId, expectedVersion, playerId }) {
  if (!isServerAuthorityEnabled()) throw new Error('Server authority is disabled.');
  const callable = httpsCallable(getClient(), 'rollGameDice');
  const response = await callable({ gameId, actionId, expectedVersion, playerId });
  return response.data;
}

export async function submitGameAction({ gameId, actionId, expectedVersion, action }) {
  if (!isServerAuthorityEnabled()) throw new Error('Server authority is disabled.');
  const callable = httpsCallable(getClient(), 'submitGameAction');
  const response = await callable({ gameId, actionId, expectedVersion, action });
  return response.data;
}

export async function recordMatchCompletion({ gameId }) {
  if (!isServerAuthorityEnabled()) throw new Error('Server authority is disabled.');
  const callable = httpsCallable(getClient(), 'recordMatchCompletion');
  const response = await callable({ gameId });
  return response.data;
}

async function callEconomy(name, data = {}) {
  if (!isServerAuthorityEnabled()) throw new Error('Server authority is disabled.');
  const callable = httpsCallable(getClient(), name);
  const response = await callable(data);
  return response.data;
}

export const getEconomyState = () => callEconomy('getEconomyState');
export const claimDailyReward = () => callEconomy('claimDailyReward');
export const recordGoalProgress = (progress) => callEconomy('recordGoalProgress', progress);
export const claimGoalReward = (reward) => callEconomy('claimGoalReward', reward);
export const claimRewardMultiplier = (reward) => callEconomy('claimRewardMultiplier', reward);
export const purchasePieceSkin = (pieceSkinId) => callEconomy('purchasePieceSkin', { pieceSkinId });
export const reservePublicMatchEntry = (matchId) => callEconomy('reservePublicMatchEntry', { matchId });
export const settlePublicMatch = (settlement) => callEconomy('settlePublicMatch', settlement);
export const refundPublicMatchEntry = (matchId, reason) => callEconomy('refundPublicMatchEntry', { matchId, reason });

export const createLobby = (config) => callEconomy('createLobby', config);
export const findPublicLobby = (config) => callEconomy('findPublicLobby', config);
export const getLobby = (lobbyId) => callEconomy('getLobby', { lobbyId });
export const claimLobbySeat = (lobbyId, playerId, name) => callEconomy('claimLobbySeat', { lobbyId, playerId, name });
export const updateLobby = (lobbyId, patch) => callEconomy('updateLobby', { lobbyId, patch });
export const heartbeatLobby = (lobbyId) => callEconomy('heartbeatLobby', { lobbyId });
export const startLobby = (lobbyId, seats) => callEconomy('startLobby', { lobbyId, seats });
export const leaveLobby = (lobbyId) => callEconomy('leaveLobby', { lobbyId });
export const initializeGame = (gameId, initialPiecePathIndex) => callEconomy('initializeGame', { gameId, initialPiecePathIndex });
export const heartbeatGame = (gameId) => callEconomy('heartbeatGame', { gameId });
export const recoverGameHost = (gameId) => callEconomy('recoverGameHost', { gameId });
export const leaveGame = (gameId) => callEconomy('leaveGame', { gameId });
export const finalizeGame = (gameId) => callEconomy('finalizeGame', { gameId });
export const updateProfileName = (displayName) => callEconomy('updateProfileName', { displayName });

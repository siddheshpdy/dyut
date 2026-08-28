import './config.js';
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './firebaseAdmin.js';

import { rejectIfAppCheckMissing, requireAuth } from './errors.js';
export { rollGameDice, submitGameAction } from './game/commands.js';
export { recordMatchCompletion } from './stats.js';
export {
  getEconomyState,
  claimDailyReward,
  recordGoalProgress,
  claimGoalReward,
  claimRewardMultiplier,
  purchasePieceSkin,
  reservePublicMatchEntry,
  settlePublicMatch,
  refundPublicMatchEntry,
} from './economy/commands.js';
export {
  createLobby,
  findPublicLobby,
  getLobby,
  claimLobbySeat,
  updateLobby,
  heartbeatLobby,
  startLobby,
  leaveLobby,
} from './lobby/commands.js';
export {
  initializeGame,
  heartbeatGame,
  recoverGameHost,
  leaveGame,
  finalizeGame,
} from './game/lifecycle.js';
export { onGameFinished } from './game/triggers.js';
export { updateProfileName } from './profile.js';

const db = getFirestore(adminApp);

// Deployment and emulator smoke-test endpoint. Sensitive operations are added
// as separate handlers so each can receive focused authorization and tests.
export const health = onCall(
  { enforceAppCheck: false },
  (request) => {
    rejectIfAppCheckMissing(request);
    return {
      ok: true,
      service: 'dyut-functions',
      generation: 2,
      authenticated: Boolean(request.auth?.uid),
      projectId: process.env.GCLOUD_PROJECT || null,
    };
  },
);

// Authenticated identity probe used while migrating the browser client. It
// intentionally returns no private profile data.
export const getServerIdentity = onCall(
  { enforceAppCheck: false },
  (request) => {
    rejectIfAppCheckMissing(request);
    return { uid: requireAuth(request) };
  },
);

// This read-only probe confirms the Admin SDK can reach the configured
// Firestore/Emulator project without exposing document contents.
export const backendStatus = onCall(
  { enforceAppCheck: false },
  async (request) => {
    rejectIfAppCheckMissing(request);
    requireAuth(request);
    await db.collection('_health').doc('functions').set({
      lastCheckedAt: new Date(),
    }, { merge: true });
    return { ok: true };
  },
);

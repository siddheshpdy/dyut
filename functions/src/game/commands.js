import { getDatabase } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FUNCTION_REGION } from '../config.js';
import { adminApp } from '../firebaseAdmin.js';
import { rejectIfAppCheckMissing, requireAuth, requireObject } from '../errors.js';
import { ACTION_TYPES, GameCommandError, applyAuthoritativeAction, rollDice } from './engine.js';

const db = getDatabase(adminApp);
const CALLABLE_OPTIONS = {
  region: FUNCTION_REGION,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 160) {
    throw new HttpsError('invalid-argument', `${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requireActionId(value) {
  const actionId = requireString(value, 'actionId');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(actionId)) {
    throw new HttpsError('invalid-argument', 'actionId contains unsupported characters.');
  }
  return actionId;
}

function toHttpsError(error) {
  if (error instanceof HttpsError) return error;
  if (error instanceof GameCommandError) return new HttpsError(error.code, error.message);
  console.error('Authoritative game command failed:', error);
  return new HttpsError('internal', 'The game command could not be completed.');
}

async function runCommand({ gameId, actionId, expectedVersion, uid, action }) {
  const gameRef = db.ref(`games/${gameId}`);
  let commandResult = null;
  let commandVersion = expectedVersion;
  let commandError = null;
  const transactionResult = await gameRef.transaction((current) => {
    if (!current) return current;
    if (current.serverAuthority !== true) {
      commandError = new GameCommandError('failed-precondition', 'This game is not managed by server authority.');
      return current;
    }
    const replay = current.actionResults?.[actionId];
    if (replay && typeof replay === 'object' && replay.result) {
      commandResult = replay.result;
      commandVersion = Number.isInteger(replay.version) ? replay.version : current.version;
      return current;
    }
    if (current.lastActionId === actionId && current.lastActionResult) {
      commandResult = current.lastActionResult;
      commandVersion = current.version;
      return current;
    }
    try {
      const currentVersion = Number.isInteger(current.version) ? current.version : 0;
      if (currentVersion !== expectedVersion) throw new GameCommandError('aborted', 'The game changed. Refresh and retry the action.');
      const result = applyAuthoritativeAction(current, action, { uid, hostUid: current.hostUid, now: Date.now() });
      commandResult = result.result;
      commandVersion = currentVersion + 1;
      const actionResults = {
        ...(current.actionResults || {}),
        [actionId]: { version: commandVersion, result: commandResult, createdAt: Date.now() },
      };
      const boundedActionResults = Object.fromEntries(
        Object.entries(actionResults).slice(-20),
      );
      return {
        ...result.state,
        version: commandVersion,
        lastActionId: actionId,
        lastActionType: action.type,
        lastActionUid: uid,
        lastActionAt: Date.now(),
        lastActionResult: result.result,
        actionResults: boundedActionResults,
      };
    } catch (error) {
      commandError = error;
      return current;
    }
  });
  if (commandError) throw commandError;
  if (!transactionResult.snapshot.exists()) throw new HttpsError('not-found', 'The game no longer exists.');
  if (!transactionResult.committed && !commandResult) throw new HttpsError('aborted', 'The game changed. Refresh and retry the action.');
  return {
    version: commandVersion ?? transactionResult.snapshot.val()?.version ?? expectedVersion,
    result: commandResult,
    // Return the committed snapshot as well as the small command result. The
    // RTDB listener remains the source of truth, but the caller can reconcile
    // immediately when a listener update is delayed or temporarily missed.
    state: transactionResult.snapshot.val(),
  };
}

export const rollGameDice = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    rejectIfAppCheckMissing(request);
    const uid = requireAuth(request);
    requireObject(request.data, 'data');
    const gameId = requireString(request.data.gameId, 'gameId');
    const actionId = requireActionId(request.data.actionId);
    const expectedVersion = Number(request.data.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new HttpsError('invalid-argument', 'expectedVersion must be a non-negative integer.');
    return await runCommand({
      gameId,
      actionId,
      expectedVersion,
      uid,
      action: { type: ACTION_TYPES.ROLL_DICE, payload: { playerId: request.data.playerId, roll: rollDice() } },
    });
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const submitGameAction = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    rejectIfAppCheckMissing(request);
    const uid = requireAuth(request);
    requireObject(request.data, 'data');
    const gameId = requireString(request.data.gameId, 'gameId');
    const actionId = requireActionId(request.data.actionId);
    const expectedVersion = Number(request.data.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new HttpsError('invalid-argument', 'expectedVersion must be a non-negative integer.');
    const action = request.data.action;
    requireObject(action, 'action');
    if (!Object.values(ACTION_TYPES).includes(action.type) || action.type === ACTION_TYPES.ROLL_DICE) throw new HttpsError('invalid-argument', 'Unsupported client game action.');
    return await runCommand({ gameId, actionId, expectedVersion, uid, action: { type: action.type, payload: action.payload || {} } });
  } catch (error) {
    throw toHttpsError(error);
  }
});

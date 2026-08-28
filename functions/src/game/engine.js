import { randomInt } from 'node:crypto';
import { PLAYER_PATHS, isSafeZone } from '../shared/boardMapping.js';
import {
  canSpawnPiece,
  getOccupantsOfPathIndex,
  getPairShieldTarget,
  getProxyPlayerId,
  getValidMoves,
  hasAnyPlayableMove,
} from '../shared/gameLogic.js';

export const DICE_FACES = [1, 3, 4, 6];
export const FINISHED_STATE = 999;
export const AFK_BOT_TAKEOVER_STRIKES = 6;
export const ONLINE_TURN_TIMEOUT_MS = 30000;
export const ACTION_TYPES = Object.freeze({
  ROLL_DICE: 'ROLL_DICE',
  SPAWN_PIECE: 'SPAWN_PIECE',
  END_TURN: 'END_TURN',
  CLEAR_QUEUE: 'CLEAR_QUEUE',
  MOVE_WITH_FULL_ROLL: 'MOVE_WITH_FULL_ROLL',
  MOVE_AND_SPLIT_ROLL: 'MOVE_AND_SPLIT_ROLL',
  EXECUTE_PAIR_ATTACK: 'EXECUTE_PAIR_ATTACK',
  DUAL_SPAWN_ATTACK: 'DUAL_SPAWN_ATTACK',
  TRIGGER_AFK_INTERVENTION: 'TRIGGER_AFK_INTERVENTION',
});

export class GameCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const fail = (message) => { throw new GameCommandError('failed-precondition', message); };
const clone = (value) => JSON.parse(JSON.stringify(value));

export function rollDice() {
  const d1 = DICE_FACES[randomInt(DICE_FACES.length)];
  const d2 = DICE_FACES[randomInt(DICE_FACES.length)];
  return { d1, d2, sum: d1 + d2 };
}

function sameTeam(state, left, right) {
  return state.isTeamMode ? state.players[left].team === state.players[right].team : left === right;
}

function isEnemy(state, left, right) {
  return state.isTeamMode ? state.players[left].team !== state.players[right].team : left !== right;
}

function applyCombat(state, playerId, pieceIndex, players, isSpawning = false) {
  const newPlayers = { ...players };
  const targetPos = newPlayers[playerId].pieces[pieceIndex];
  const targetCellId = PLAYER_PATHS[playerId]?.[targetPos];
  if (!targetCellId || targetPos === -1 || targetCellId.startsWith('CENTER') || targetCellId.includes('_HOME')) return newPlayers;

  const parts = targetCellId.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
  const targetIsSafe = parts && isSafeZone(Number(parts[2]), Number(parts[3]));
  let killedCount = 0;
  for (const [otherPlayerId, otherPlayer] of Object.entries(newPlayers)) {
    if (!isEnemy({ ...state, players: newPlayers }, playerId, otherPlayerId)) continue;
    const targetVisualId = targetCellId.replace('_HOME', '');
    const opponentPieceIndices = otherPlayer.pieces.map((position, index) => {
      const cell = position !== -1 && position !== FINISHED_STATE ? PLAYER_PATHS[otherPlayerId]?.[position] : null;
      return cell && cell.replace('_HOME', '') === targetVisualId ? index : -1;
    }).filter((index) => index !== -1);
    if (!opponentPieceIndices.length || (targetIsSafe && (!isSpawning || ![8, 12].includes(targetPos))) || opponentPieceIndices.length === 2) continue;
    newPlayers[otherPlayerId] = {
      ...otherPlayer,
      pieces: otherPlayer.pieces.map((position, index) => opponentPieceIndices.includes(index) ? -1 : position),
    };
    killedCount += opponentPieceIndices.length;
  }
  if (killedCount) {
    newPlayers[playerId] = {
      ...newPlayers[playerId],
      hasKilled: true,
      captureCount: (newPlayers[playerId].captureCount || 0) + killedCount,
    };
    if (state.isTeamMode) {
      for (const [id, player] of Object.entries(newPlayers)) {
        if (player.team === newPlayers[playerId].team) newPlayers[id] = { ...player, hasKilled: true };
      }
    }
  }
  return newPlayers;
}

function isWinner(state, players, playerId) {
  if (state.isTeamMode) {
    const team = players[playerId].team;
    return Object.values(players).filter((player) => player.team === team).every((player) => player.pieces.every((piece) => piece === FINISHED_STATE));
  }
  return state.isQuickGame
    ? players[playerId].pieces.some((piece) => piece === FINISHED_STATE)
    : players[playerId].pieces.every((piece) => piece === FINISHED_STATE);
}

function completeIfWon(state, playerId) {
  if (!isWinner(state, state.players, playerId)) return state;
  return { ...state, status: 'finished', winnerPlayerId: playerId };
}

function currentActorId(state, requestedPlayerId) {
  const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
  if (requestedPlayerId && requestedPlayerId !== activePlayerId) fail('The requested player is not active.');
  return activePlayerId;
}

function removeRoll(queue, rollIndex) {
  if (!Number.isInteger(rollIndex) || rollIndex < 0 || rollIndex >= queue.length) fail('The selected roll is no longer available.');
  return queue.filter((_, index) => index !== rollIndex);
}

function updateTurnMetadata(state, action, now) {
  const next = { ...state, lastActionTime: now };
  if (action.type === ACTION_TYPES.END_TURN || action.type === ACTION_TYPES.ROLL_DICE) next.turnStartedAt = now;
  if (action.type === ACTION_TYPES.END_TURN) next.isAfkTurn = false;
  return next;
}

function applyAction(state, action, now) {
  const next = clone(state);
  const payload = action.payload || {};
  const playerId = currentActorId(next, payload.playerId);
  next.players = next.players || {};
  if (!next.players[playerId]) fail('The active player does not exist.');

  switch (action.type) {
    case ACTION_TYPES.ROLL_DICE: {
      if (next.hasRolledThisTurn && next.rollingPhaseComplete) fail('The rolling phase is complete.');
      const roll = payload.roll || rollDice();
      const isVoid = next.isVoidRuleEnabled && ((roll.d1 === 1 && roll.d2 === 3) || (roll.d1 === 3 && roll.d2 === 1));
      if (isVoid) {
        next.turnQueue = [];
        next.hasRolledThisTurn = true;
        next.rollingPhaseComplete = true;
        next.lastRoll = roll;
        return { state: updateTurnMetadata(next, action, now), result: { kind: 'void', roll } };
      }
      next.turnQueue = [...(next.turnQueue || []), roll];
      next.hasRolledThisTurn = true;
      next.rollingPhaseComplete = !(roll.d1 === roll.d2);
      next.lastRoll = roll;
      return { state: updateTurnMetadata(next, action, now), result: { kind: 'roll', roll } };
    }

    case ACTION_TYPES.SPAWN_PIECE: {
      const { pieceIndex, rollIndex } = payload;
      const roll = next.turnQueue?.[rollIndex];
      if (!roll || roll.d1 !== roll.d2 || next.players[playerId].pieces[pieceIndex] !== -1) fail('That piece cannot be spawned with the selected roll.');
      const spawnPosition = roll.sum;
      const spawnResult = canSpawnPiece(playerId, spawnPosition, next);
      if (!spawnResult) fail('The spawn square is blocked.');
      if (spawnResult === 'DUAL_SPAWN') fail('Use the dual spawn action for this shield.');
      const players = { ...next.players, [playerId]: { ...next.players[playerId], pieces: [...next.players[playerId].pieces] } };
      players[playerId].pieces[pieceIndex] = spawnPosition;
      next.players = applyCombat(next, playerId, pieceIndex, players, true);
      next.turnQueue = removeRoll(next.turnQueue, rollIndex);
      return { state: completeIfWon(next, playerId), result: { kind: 'spawn' } };
    }

    case ACTION_TYPES.MOVE_WITH_FULL_ROLL: {
      const { pieceIndex, rollIndex, distance } = payload;
      const roll = next.turnQueue?.[rollIndex];
      const currentPosition = next.players[playerId].pieces[pieceIndex];
      if (!roll || currentPosition < 0 || currentPosition === FINISHED_STATE) fail('That piece cannot be moved.');
      const expectedDistance = roll.d2 == null ? roll.d1 : roll.sum;
      if (distance !== expectedDistance || !getValidMoves(currentPosition, roll, playerId, next).sum) fail('That move is not legal.');
      const newPosition = currentPosition + distance;
      const players = { ...next.players, [playerId]: { ...next.players[playerId], pieces: [...next.players[playerId].pieces] } };
      players[playerId].pieces[pieceIndex] = newPosition === PLAYER_PATHS[playerId].length - 1 ? FINISHED_STATE : newPosition;
      next.players = newPosition === FINISHED_STATE ? players : applyCombat(next, playerId, pieceIndex, players);
      next.turnQueue = removeRoll(next.turnQueue, rollIndex);
      return { state: completeIfWon(next, playerId), result: { kind: 'move' } };
    }

    case ACTION_TYPES.MOVE_AND_SPLIT_ROLL: {
      const { pieceIndex, rollIndex, distanceUsed } = payload;
      const roll = next.turnQueue?.[rollIndex];
      const currentPosition = next.players[playerId].pieces[pieceIndex];
      if (!roll || roll.d2 == null || currentPosition < 0 || currentPosition === FINISHED_STATE) fail('That split move is not legal.');
      const high = Math.max(roll.d1, roll.d2);
      const low = Math.min(roll.d1, roll.d2);
      const valid = getValidMoves(currentPosition, roll, playerId, next);
      if (![high, low].includes(distanceUsed) || !valid[distanceUsed === high ? 'high' : 'low']) fail('That split move is not legal.');
      const newPosition = currentPosition + distanceUsed;
      const players = { ...next.players, [playerId]: { ...next.players[playerId], pieces: [...next.players[playerId].pieces] } };
      players[playerId].pieces[pieceIndex] = newPosition === PLAYER_PATHS[playerId].length - 1 ? FINISHED_STATE : newPosition;
      next.players = newPosition === FINISHED_STATE ? players : applyCombat(next, playerId, pieceIndex, players);
      next.turnQueue = [...next.turnQueue];
      next.turnQueue[rollIndex] = { d1: roll.sum - distanceUsed, d2: null, sum: roll.sum - distanceUsed };
      return { state: completeIfWon(next, playerId), result: { kind: 'move-split' } };
    }

    case ACTION_TYPES.EXECUTE_PAIR_ATTACK: {
      const { rollIndex, firstPieceIndex, secondPieceIndex, targetCellId } = payload;
      const roll = next.turnQueue?.[rollIndex];
      if (!roll || roll.d1 !== roll.d2 || firstPieceIndex === secondPieceIndex) fail('That pair attack is not legal.');
      const moveDistance = roll.d1;
      const firstPosition = next.players[playerId].pieces[firstPieceIndex];
      const secondPosition = next.players[playerId].pieces[secondPieceIndex];
      const targetPosition = firstPosition + moveDistance;
      if (secondPosition + moveDistance !== targetPosition || getPairShieldTarget(targetPosition, playerId, next) === null) fail('The target is not a pair shield.');
      const targetVisualId = PLAYER_PATHS[playerId][targetPosition]?.replace('_HOME', '');
      const players = clone(next.players);
      players[playerId].pieces[firstPieceIndex] = targetPosition;
      players[playerId].pieces[secondPieceIndex] = targetPosition;
      players[playerId].hasKilled = true;
      players[playerId].captureCount = (players[playerId].captureCount || 0) + 2;
      for (const [defenderId, defender] of Object.entries(players)) {
        if (defenderId === playerId || (next.isTeamMode && defender.team === players[playerId].team)) continue;
        const defeated = defender.pieces.map((position, index) => {
          const cell = position !== -1 && position !== FINISHED_STATE ? PLAYER_PATHS[defenderId]?.[position] : null;
          return cell?.replace('_HOME', '') === targetVisualId ? index : -1;
        }).filter((index) => index !== -1);
        if (defeated.length === 2) players[defenderId].pieces = players[defenderId].pieces.map((position, index) => defeated.includes(index) ? -1 : position);
      }
      next.players = players;
      next.turnQueue = removeRoll(next.turnQueue, rollIndex);
      return { state: completeIfWon(next, playerId), result: { kind: 'pair-attack' } };
    }

    case ACTION_TYPES.DUAL_SPAWN_ATTACK: {
      const { pieceIndices, rollIndices } = payload;
      if (!Array.isArray(pieceIndices) || pieceIndices.length !== 2 || !Array.isArray(rollIndices) || rollIndices.length !== 2) fail('That dual spawn is not valid.');
      const firstRoll = next.turnQueue?.[rollIndices[0]];
      const secondRoll = next.turnQueue?.[rollIndices[1]];
      if (!firstRoll || !secondRoll || firstRoll.d1 !== firstRoll.d2 || firstRoll.sum !== secondRoll.sum) fail('Two matching doubles are required.');
      if (!pieceIndices.every((index) => next.players[playerId].pieces[index] === -1) || canSpawnPiece(playerId, firstRoll.sum, next) !== 'DUAL_SPAWN') fail('The dual spawn is not available.');
      const spawnPosition = firstRoll.sum;
      const targetCellId = PLAYER_PATHS[playerId][spawnPosition]?.replace('_HOME', '');
      const players = clone(next.players);
      for (const index of pieceIndices) players[playerId].pieces[index] = spawnPosition;
      players[playerId].hasKilled = true;
      players[playerId].captureCount = (players[playerId].captureCount || 0) + 2;
      for (const [defenderId, defender] of Object.entries(players)) {
        if (defenderId === playerId || (next.isTeamMode && defender.team === players[playerId].team)) continue;
        const defeated = defender.pieces.map((position, index) => {
          const cell = position !== -1 && position !== FINISHED_STATE ? PLAYER_PATHS[defenderId]?.[position] : null;
          return cell?.replace('_HOME', '') === targetCellId ? index : -1;
        }).filter((index) => index !== -1);
        if (defeated.length === 2) players[defenderId].pieces = players[defenderId].pieces.map((position, index) => defeated.includes(index) ? -1 : position);
      }
      next.players = players;
      next.turnQueue = next.turnQueue.filter((_, index) => !rollIndices.includes(index));
      return { state: completeIfWon(next, playerId), result: { kind: 'dual-spawn' } };
    }

    case ACTION_TYPES.CLEAR_QUEUE:
      if (!next.isVoidRuleEnabled) fail('The Void Rule is disabled.');
      if (!next.lastRoll || !((next.lastRoll.d1 === 1 && next.lastRoll.d2 === 3) || (next.lastRoll.d1 === 3 && next.lastRoll.d2 === 1))) fail('Only a Void roll can clear the queue.');
      next.turnQueue = [];
      next.hasRolledThisTurn = true;
      next.rollingPhaseComplete = true;
      return { state: next, result: { kind: 'void' } };

    case ACTION_TYPES.END_TURN: {
      if (next.turnQueue?.length && hasAnyPlayableMove(playerId, next)) fail('Playable moves remain in the queue.');
      const playerKeys = Object.keys(next.players).sort();
      const currentIndex = playerKeys.indexOf(next.currentPlayer);
      next.currentPlayer = playerKeys[(currentIndex + 1) % playerKeys.length];
      next.turnQueue = [];
      next.lastRoll = null;
      next.hasRolledThisTurn = false;
      next.rollingPhaseComplete = false;
      return { state: updateTurnMetadata(next, action, now), result: { kind: 'end-turn' } };
    }

    case ACTION_TYPES.TRIGGER_AFK_INTERVENTION: {
      if (Number.isFinite(next.turnStartedAt) && now - next.turnStartedAt < ONLINE_TURN_TIMEOUT_MS) fail('The active turn has not timed out.');
      if (!next.afkStrikes) next.afkStrikes = {};
      const strikes = (next.afkStrikes[playerId] || 0) + 1;
      next.afkStrikes[playerId] = strikes;
      if (strikes >= AFK_BOT_TAKEOVER_STRIKES) {
        next.bots = [...new Set([...(next.bots || []), playerId])];
        const activeHumanIds = Object.keys(next.playerUids || {}).filter((id) => next.playerUids[id] && !next.bots.includes(id));
        next.isAfkTurn = false;
        if (activeHumanIds.length < 2) {
          next.status = 'finished';
          if (activeHumanIds[0]) next.winnerPlayerId = activeHumanIds[0];
        }
      } else {
        next.isAfkTurn = true;
      }
      return { state: updateTurnMetadata(next, action, now), result: { kind: 'afk-intervention', strikes } };
    }

    default:
      fail('Unsupported game command.');
  }
}

export function applyAuthoritativeAction(rawState, action, { uid, hostUid, now = Date.now() } = {}) {
  if (!rawState || !rawState.players || !uid) throw new GameCommandError('invalid-argument', 'A game and authenticated player are required.');
  if (rawState.status !== 'playing') fail('This game is not active.');
  const playerUids = rawState.playerUids || {};
  const ownedPlayerIds = Object.entries(playerUids).filter(([, playerUid]) => playerUid === uid).map(([playerId]) => playerId);
  const activeId = getProxyPlayerId(rawState.currentPlayer, rawState);
  const requestedPlayerId = action?.payload?.playerId || activeId;
  const isOwnTurn = ownedPlayerIds.includes(activeId) && (!requestedPlayerId || requestedPlayerId === activeId);
  const canControlBot = uid === hostUid && (rawState.bots || []).includes(activeId);
  const canManageAfk = uid === hostUid && action?.type === ACTION_TYPES.TRIGGER_AFK_INTERVENTION;
  if (!isOwnTurn && !canControlBot && !canManageAfk) throw new GameCommandError('permission-denied', 'You cannot control this turn.');
  return applyAction(rawState, action, now);
}

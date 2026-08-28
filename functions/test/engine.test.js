import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TYPES, GameCommandError, applyAuthoritativeAction } from '../src/game/engine.js';

function createState(overrides = {}) {
  return {
    currentPlayer: 'Player1',
    turnQueue: [],
    players: {
      Player1: { pieces: [0, -1, -1, -1], team: 0, hasKilled: false, captureCount: 0 },
      Player2: { pieces: [-1, -1, -1, -1], team: 0, hasKilled: false, captureCount: 0 },
    },
    playerUids: { Player1: 'uid-1', Player2: 'uid-2' },
    hostUid: 'uid-1',
    bots: [],
    isTeamMode: false,
    isQuickGame: false,
    isVoidRuleEnabled: true,
    hasRolledThisTurn: false,
    rollingPhaseComplete: false,
    status: 'playing',
    ...overrides,
  };
}

test('server generates a normal roll and queues it', () => {
  const result = applyAuthoritativeAction(createState(), {
    type: ACTION_TYPES.ROLL_DICE,
    payload: { playerId: 'Player1', roll: { d1: 4, d2: 6, sum: 10 } },
  }, { uid: 'uid-1', hostUid: 'uid-1', now: 10 });

  assert.deepEqual(result.state.turnQueue, [{ d1: 4, d2: 6, sum: 10 }]);
  assert.equal(result.state.rollingPhaseComplete, true);
  assert.equal(result.result.kind, 'roll');
});

test('Void Rule clears a 1+3 roll without trusting the browser', () => {
  const result = applyAuthoritativeAction(createState(), {
    type: ACTION_TYPES.ROLL_DICE,
    payload: { playerId: 'Player1', roll: { d1: 1, d2: 3, sum: 4 } },
  }, { uid: 'uid-1', hostUid: 'uid-1' });

  assert.deepEqual(result.state.turnQueue, []);
  assert.equal(result.result.kind, 'void');
});

test('server validates movement and removes the consumed roll', () => {
  const result = applyAuthoritativeAction(createState({
    turnQueue: [{ d1: 4, d2: 6, sum: 10 }],
    hasRolledThisTurn: true,
    rollingPhaseComplete: true,
  }), {
    type: ACTION_TYPES.MOVE_WITH_FULL_ROLL,
    payload: { playerId: 'Player1', pieceIndex: 0, rollIndex: 0, distance: 10 },
  }, { uid: 'uid-1', hostUid: 'uid-1' });

  assert.equal(result.state.players.Player1.pieces[0], 10);
  assert.deepEqual(result.state.turnQueue, []);
});

test('a different player cannot submit the active turn', () => {
  assert.throws(() => applyAuthoritativeAction(createState(), {
    type: ACTION_TYPES.ROLL_DICE,
    payload: { playerId: 'Player1', roll: { d1: 4, d2: 4, sum: 8 } },
  }, { uid: 'uid-2', hostUid: 'uid-1' }), (error) => {
    assert.ok(error instanceof GameCommandError);
    assert.equal(error.code, 'permission-denied');
    return true;
  });
});

test('a player cannot bypass turn ownership by naming their own seat', () => {
  assert.throws(() => applyAuthoritativeAction(createState(), {
    type: ACTION_TYPES.ROLL_DICE,
    payload: { playerId: 'Player2', roll: { d1: 4, d2: 4, sum: 8 } },
  }, { uid: 'uid-2', hostUid: 'uid-1' }), (error) => {
    assert.ok(error instanceof GameCommandError);
    assert.equal(error.code, 'permission-denied');
    return true;
  });
});

test('host can record AFK strikes and bot takeover server-side', () => {
  const state = createState({
    hostUid: 'uid-1',
    afkStrikes: { Player1: 5 },
    bots: [],
  });
  const result = applyAuthoritativeAction(state, {
    type: ACTION_TYPES.TRIGGER_AFK_INTERVENTION,
    payload: { playerId: 'Player1' },
  }, { uid: 'uid-1', hostUid: 'uid-1' });

  assert.deepEqual(result.state.bots, ['Player1']);
  assert.equal(result.state.status, 'finished');
  assert.equal(result.state.winnerPlayerId, 'Player2');
});

test('server rejects commands for a non-playing game', () => {
  assert.throws(() => applyAuthoritativeAction(createState({ status: 'waiting' }), {
    type: ACTION_TYPES.ROLL_DICE,
    payload: { playerId: 'Player1', roll: { d1: 4, d2: 4, sum: 8 } },
  }, { uid: 'uid-1', hostUid: 'uid-1' }), (error) => {
    assert.ok(error instanceof GameCommandError);
    assert.equal(error.code, 'failed-precondition');
    return true;
  });
});

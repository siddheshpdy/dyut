import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_PATHS as clientPaths,
  isSafeZone as clientIsSafeZone,
} from '../../boardMapping.js';
import {
  canSpawnPiece as clientCanSpawnPiece,
  getValidMoves as clientGetValidMoves,
} from '../../gameLogic.js';
import {
  PLAYER_PATHS as serverPaths,
  isSafeZone as serverIsSafeZone,
} from '../src/shared/boardMapping.js';
import {
  canSpawnPiece as serverCanSpawnPiece,
  getValidMoves as serverGetValidMoves,
} from '../src/shared/gameLogic.js';

const makeState = (overrides = {}) => ({
  isTeamMode: false,
  turnQueue: [],
  players: {
    Player1: { pieces: [0, -1, -1, -1], team: 0, hasKilled: false },
    Player2: { pieces: [-1, -1, -1, -1], team: 0, hasKilled: false },
  },
  ...overrides,
});

test('server and browser board paths remain identical', () => {
  assert.deepEqual(serverPaths, clientPaths);
  for (let col = 0; col < 3; col += 1) {
    for (let row = 0; row < 8; row += 1) {
      assert.equal(serverIsSafeZone(col, row), clientIsSafeZone(col, row));
    }
  }
});

test('server and browser movement helpers agree on representative fixtures', () => {
  const state = makeState();
  const roll = { d1: 4, d2: 6, sum: 10 };
  assert.deepEqual(
    serverGetValidMoves(0, roll, 'Player1', state),
    clientGetValidMoves(0, roll, 'Player1', state),
  );
  assert.equal(
    serverCanSpawnPiece('Player1', 8, state),
    clientCanSpawnPiece('Player1', 8, state),
  );
  assert.equal(
    serverCanSpawnPiece('Player1', 12, { ...state, turnQueue: [{ d1: 6, d2: 6, sum: 12 }] }),
    clientCanSpawnPiece('Player1', 12, { ...state, turnQueue: [{ d1: 6, d2: 6, sum: 12 }] }),
  );
});

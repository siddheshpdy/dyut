import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBestAIMove } from './aiLogic';
import { getValidMoves, willMoveKill } from './gameLogic';

vi.mock('./boardMapping', () => ({
  PLAYER_PATHS: {
    Player1: Array.from({ length: 20 }, (_, index) => `path${index}`),
  },
  isSafeZone: vi.fn(() => false),
}));

vi.mock('./GameContext', () => ({
  ACTION_TYPES: {
    SPAWN_PIECE: 'SPAWN_PIECE',
    MOVE_WITH_FULL_ROLL: 'MOVE_WITH_FULL_ROLL',
    MOVE_AND_SPLIT_ROLL: 'MOVE_AND_SPLIT_ROLL',
    EXECUTE_PAIR_ATTACK: 'EXECUTE_PAIR_ATTACK',
    DUAL_SPAWN_ATTACK: 'DUAL_SPAWN_ATTACK',
  },
}));

vi.mock('./gameLogic', () => ({
  getProxyPlayerId: vi.fn((playerId) => playerId),
  canSpawnPiece: vi.fn(() => false),
  getValidMoves: vi.fn((_position, roll) => (
    roll.sum === 5
      ? { sum: true, high: false, low: false }
      : { sum: false, high: false, low: false }
  )),
  willMoveKill: vi.fn(() => false),
  getOccupantsOfPathIndex: vi.fn(() => []),
  getPairShieldTarget: vi.fn(() => null),
}));

describe('getBestAIMove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidMoves.mockImplementation((_position, roll) => (
      roll.sum === 5
        ? { sum: true, high: false, low: false }
        : { sum: false, high: false, low: false }
    ));
    willMoveKill.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a later queued roll when the first roll is blocked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = {
      isTeamMode: false,
      turnQueue: [
        { d1: 1, d2: 1, sum: 2 },
        { d1: 1, d2: 4, sum: 5 },
      ],
      players: {
        Player1: { hasKilled: true, pieces: [0, 1, 999, 999] },
      },
    };

    const action = getBestAIMove('Player1', state, 'hard');

    expect(getValidMoves).toHaveBeenCalledWith(0, state.turnQueue[1], 'Player1', state);
    expect(action).toEqual({
      type: 'MOVE_WITH_FULL_ROLL',
      payload: { playerId: 'Player1', pieceIndex: 0, rollIndex: 1, distance: 5 },
    });
  });

  it('keeps the bot on the sum even when a split move has a better score', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    getValidMoves.mockReturnValue({ sum: true, high: true, low: true });
    willMoveKill.mockImplementation((targetPosition) => targetPosition === 6);
    const state = {
      isTeamMode: false,
      turnQueue: [{ d1: 4, d2: 6, sum: 10 }],
      players: {
        Player1: { hasKilled: true, pieces: [0, 999, 999, 999] },
      },
    };

    const action = getBestAIMove('Player1', state, 'hard');

    expect(action).toEqual({
      type: 'MOVE_WITH_FULL_ROLL',
      payload: { playerId: 'Player1', pieceIndex: 0, rollIndex: 0, distance: 10 },
    });
  });
});

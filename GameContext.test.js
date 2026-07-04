import { describe, it, expect, vi } from 'vitest';

vi.mock('./boardMapping', () => ({
  PLAYER_PATHS: {
    Player1: ['path0', 'path1', 'CENTER'],
    Player2: ['path0', 'path1', 'CENTER'],
  },
  isSafeZone: vi.fn(() => false),
}));

vi.mock('./firebaseSetup.js', () => ({
  db: {},
  rtdb: {},
  updateUserStats: vi.fn(),
}));

vi.mock('./gameLogic', () => ({
  getProxyPlayerId: vi.fn((playerId) => playerId),
}));

import {
  ACTION_TYPES,
  OFFLINE_TURN_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  applyReducerPostProcessing,
  canLocalClientAct,
  gameReducer,
  getTurnRemainingMs,
  getTurnTimeoutMs,
} from './GameContext';

const createBaseOnlineState = () => ({
  currentPlayer: 'Player1',
  turnQueue: [],
  hasRolledThisTurn: false,
  rollingPhaseComplete: false,
  players: {
    Player1: { color: 'ruby', name: 'Alice', hasKilled: false, pieces: [0, -1, -1, -1], team: 0 },
    Player2: { color: 'sapphire', name: 'Bob', hasKilled: false, pieces: [0, -1, -1, -1], team: 0 },
  },
  bots: [],
  afkStrikes: {},
  isAfkTurn: false,
  isOnline: true,
  localUid: 'user-1',
  hostUid: 'host-1',
  playerUids: { Player1: 'user-1', Player2: 'user-2' },
  turnStartedAt: 1000,
  lastActionTime: 1000,
  isTeamMode: false,
});

describe('GameContext reducer AFK reclaim', () => {
  it('clears temporary auto-control when the active player reclaims their turn', () => {
    const baseState = {
      ...createBaseOnlineState(),
      turnQueue: [{ d1: 4, d2: null, sum: 4 }],
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      bots: ['Player1'],
      afkStrikes: { Player1: 2 },
      isAfkTurn: true,
      turnStartedAt: 100,
      lastActionTime: 123,
    };

    const action = {
      type: ACTION_TYPES.MOVE_WITH_FULL_ROLL,
      payload: { playerId: 'Player1', pieceIndex: 0, rollIndex: 0, distance: 1 },
      _clearAutoControlForPlayerId: 'Player1',
    };

    const reducedState = gameReducer(baseState, action);
    const processedState = applyReducerPostProcessing(reducedState, action);

    expect(processedState.bots).not.toContain('Player1');
    expect(processedState.afkStrikes.Player1).toBe(0);
    expect(processedState.isAfkTurn).toBe(false);
    expect(processedState.players.Player1.pieces[0]).toBe(1);
  });

  it('resets the turn timer when the player rolls the dice', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(4000);
    const baseState = {
      ...createBaseOnlineState(),
      turnStartedAt: 1000,
      lastActionTime: 2500,
    };

    const action = {
      type: ACTION_TYPES.ROLL_DICE,
      payload: { d1: 4, d2: 4, sum: 8 },
      _updateActivity: true,
    };
    const reducedState = gameReducer(baseState, action);
    const processedState = applyReducerPostProcessing(reducedState, action);

    expect(processedState.turnStartedAt).toBe(4000);
    expect(processedState.lastActionTime).toBe(4000);
    expect(processedState.turnQueue).toEqual([{ d1: 4, d2: 4, sum: 8 }]);

    dateNowSpy.mockRestore();
  });

  it('resets the turn timer when the turn advances', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(5000);
    const baseState = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player1',
      turnStartedAt: 1000,
      lastActionTime: 3200,
      isAfkTurn: true,
    };

    const action = { type: ACTION_TYPES.END_TURN, _updateActivity: true };
    const reducedState = gameReducer(baseState, action);
    const processedState = applyReducerPostProcessing(reducedState, action);

    expect(processedState.currentPlayer).toBe('Player2');
    expect(processedState.turnStartedAt).toBe(5000);
    expect(processedState.lastActionTime).toBe(5000);
    expect(processedState.isAfkTurn).toBe(false);

    dateNowSpy.mockRestore();
  });

  it('escalates repeat AFK timeouts into permanent bot control', () => {
    const baseState = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player2',
      afkStrikes: { Player2: 5 },
    };

    const reducedState = gameReducer(baseState, {
      type: ACTION_TYPES.TRIGGER_AFK_INTERVENTION,
      payload: { playerId: 'Player2' },
    });

    expect(reducedState.afkStrikes.Player2).toBe(6);
    expect(reducedState.bots).toContain('Player2');
  });

  it('lets only the host auto-play a reclaimed remote turn', () => {
    const remoteAfkTurnForHost = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player2',
      localUid: 'host-1',
      isAfkTurn: true,
    };
    const remoteAfkTurnForNonHost = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player2',
      localUid: 'user-1',
      isAfkTurn: true,
    };

    expect(canLocalClientAct(remoteAfkTurnForHost)).toBe(true);
    expect(canLocalClientAct(remoteAfkTurnForNonHost)).toBe(false);
  });

  it('bases the visible countdown on turn start instead of the last action', () => {
    const countdownState = {
      ...createBaseOnlineState(),
      turnStartedAt: 1000,
      lastActionTime: 24000,
    };

    expect(getTurnRemainingMs(countdownState, 25000)).toBe(6000);
  });

  it('falls back to lastActionTime when turnStartedAt is missing from older synced data', () => {
    const olderSyncedState = {
      ...createBaseOnlineState(),
      turnStartedAt: undefined,
      lastActionTime: 5000,
    };

    expect(getTurnRemainingMs(olderSyncedState, 5000 + TURN_TIMEOUT_MS - 1)).toBe(1);
  });

  it('uses a 60 second timer for offline turns', () => {
    const offlineState = {
      ...createBaseOnlineState(),
      isOnline: false,
      turnStartedAt: 2000,
      lastActionTime: 2000,
    };

    expect(getTurnTimeoutMs(offlineState)).toBe(OFFLINE_TURN_TIMEOUT_MS);
    expect(getTurnRemainingMs(offlineState, 32000)).toBe(30000);
  });
});

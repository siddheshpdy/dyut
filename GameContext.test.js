import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
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
  clearAccountResumeGame: vi.fn(async () => {}),
  updateUserStats: vi.fn(),
}));

const economyContextMocks = vi.hoisted(() => ({
  settlePublicMatch: vi.fn(async () => ({ applied: true })),
}));

vi.mock('./EconomyContext', () => ({
  useOptionalEconomy: () => ({
    settlePublicMatch: economyContextMocks.settlePublicMatch,
  }),
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn((_database, path) => path),
  onValue: vi.fn(() => () => {}),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
}));

vi.mock('./gameLogic', () => ({
  getProxyPlayerId: vi.fn((playerId) => playerId),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import {
  ACTION_TYPES,
  AFK_BOT_TAKEOVER_STRIKES,
  buildPublicPresenceLossUpdates,
  GameProvider,
  initGameState,
  OFFLINE_TURN_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  applyReducerPostProcessing,
  canLocalClientAct,
  gameReducer,
  getTurnRemainingMs,
  getTurnTimeoutMs,
  readPositiveIntegerEnv,
  shouldLocalClientAutoRoll,
  shouldLocalClientAutoControlTurn,
  useGame,
} from './GameContext';
import { onValue as subscribeToGame, set as setGameRecord, update as updateGameRecord } from 'firebase/database';

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
  it('exports positive timer and AFK configuration values', () => {
    expect(TURN_TIMEOUT_MS).toBeGreaterThan(0);
    expect(OFFLINE_TURN_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AFK_BOT_TAKEOVER_STRIKES).toBeGreaterThan(0);
  });

  it('parses only positive whole-number env configuration values', () => {
    const env = {
      GOOD_VALUE: '45000',
      ZERO_VALUE: '0',
      DECIMAL_VALUE: '2.5',
      BAD_VALUE: 'soon',
    };

    expect(readPositiveIntegerEnv(env, 'GOOD_VALUE', 30000)).toBe(45000);
    expect(readPositiveIntegerEnv(env, 'ZERO_VALUE', 30000)).toBe(30000);
    expect(readPositiveIntegerEnv(env, 'DECIMAL_VALUE', 30000)).toBe(30000);
    expect(readPositiveIntegerEnv(env, 'BAD_VALUE', 30000)).toBe(30000);
    expect(readPositiveIntegerEnv(env, 'MISSING_VALUE', 30000)).toBe(30000);
  });

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

    expect(reducedState.afkStrikes.Player2).toBe(AFK_BOT_TAKEOVER_STRIKES);
    expect(reducedState.bots).toContain('Player2');
    expect(reducedState.status).toBe('finished');
    expect(reducedState.winnerPlayerId).toBe('Player1');
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
    expect(shouldLocalClientAutoControlTurn(remoteAfkTurnForHost)).toBe(true);
    expect(shouldLocalClientAutoControlTurn(remoteAfkTurnForNonHost)).toBe(false);
  });

  it('keeps permanent bot auto-control on the host while a multiplayer match remains active', () => {
    const permanentBotTurnForHost = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player2',
      localUid: 'host-1',
      bots: ['Player2'],
    };

    expect(shouldLocalClientAutoControlTurn(permanentBotTurnForHost)).toBe(true);
  });

  it('lets the host immediately control bot-filled seats in a two-human, two-bot online match', () => {
    const twoHumansTwoBots = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player3',
      localUid: 'host-1',
      players: {
        ...createBaseOnlineState().players,
        Player3: { color: 'emerald', name: 'Bot 3', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player4: { color: 'amber', name: 'Bot 4', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
      },
      playerUids: { Player1: 'host-1', Player2: 'user-2', Player3: null, Player4: null },
      bots: ['Player3', 'Player4'],
    };

    expect(canLocalClientAct(twoHumansTwoBots)).toBe(true);
    expect(shouldLocalClientAutoControlTurn(twoHumansTwoBots)).toBe(true);
    expect(shouldLocalClientAutoRoll(twoHumansTwoBots)).toBe(true);
  });

  it('stops the bot-roll fallback as soon as the bot finishes its rolling phase', () => {
    const botFinishedRolling = {
      ...createBaseOnlineState(),
      currentPlayer: 'Player2',
      localUid: 'host-1',
      bots: ['Player2'],
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      playerUids: { Player1: 'host-1', Player2: null },
    };

    expect(shouldLocalClientAutoRoll(botFinishedRolling)).toBe(false);
  });

  it('rolls a two-human, two-bot host turn within the fallback window instead of the online timeout', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(React.createElement(
      GameProvider,
      {
        gameConfig: {
          playerCount: 4,
          activeSeats: ['Player3', 'Player4', 'Player1', 'Player2'],
          playerColors: ['emerald', 'amber', 'ruby', 'sapphire'],
          playerAliases: { Player1: 'Host', Player2: 'Guest', Player3: 'Bot 3', Player4: 'Bot 4' },
          playerUids: { Player1: 'host-1', Player2: 'user-2', Player3: null, Player4: null },
          bots: ['Player3', 'Player4'],
          isOnline: true,
          hostUid: 'host-1',
          localUid: 'host-1',
        },
      },
      React.createElement(BotRollFallbackProbe),
    ));

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId('bot-roll-count')).toHaveTextContent('0');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('bot-roll-count')).toHaveTextContent('1');

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists host and player ownership for a two-human, two-bot online game', async () => {
    subscribeToGame.mockImplementationOnce((_reference, callback) => {
      callback({ exists: () => false });
      return () => {};
    });

    render(React.createElement(
      GameProvider,
      {
        gameConfig: {
          playerCount: 4,
          activeSeats: ['Player1', 'Player2', 'Player3', 'Player4'],
          playerColors: ['ruby', 'sapphire', 'emerald', 'amber'],
          playerUids: { Player1: 'host-1', Player2: 'user-2', Player3: null, Player4: null },
          bots: ['Player3', 'Player4'],
          isOnline: true,
          gameId: 'bot-fill-test',
          hostUid: 'host-1',
          localUid: 'host-1',
        },
      },
      React.createElement(BotRollFallbackProbe),
    ));

    await Promise.resolve();
    expect(setGameRecord).toHaveBeenCalledWith('games/bot-fill-test', expect.objectContaining({
      hostUid: 'host-1',
      playerUids: { Player1: 'host-1', Player2: 'user-2', Player3: null, Player4: null },
      bots: ['Player3', 'Player4'],
    }));
  });

  it('backfills missing bot ownership metadata for a game created by an older cached client', async () => {
    updateGameRecord.mockClear();
    subscribeToGame.mockImplementationOnce((_reference, callback) => {
      callback({
        exists: () => true,
        val: () => ({
          currentPlayer: 'Player4',
          players: createBaseOnlineState().players,
          turnQueue: [],
          hasRolledThisTurn: false,
          rollingPhaseComplete: false,
        }),
      });
      return () => {};
    });

    render(React.createElement(
      GameProvider,
      {
        gameConfig: {
          playerCount: 4,
          activeSeats: ['Player1', 'Player2', 'Player3', 'Player4'],
          playerColors: ['ruby', 'sapphire', 'emerald', 'amber'],
          playerUids: { Player1: 'host-1', Player2: 'user-2', Player3: null, Player4: null },
          bots: ['Player3', 'Player4'],
          isOnline: true,
          gameId: 'legacy-bot-fill-test',
          hostUid: 'host-1',
          localUid: 'host-1',
        },
      },
      React.createElement(BotRollFallbackProbe),
    ));

    await Promise.resolve();
    expect(updateGameRecord).toHaveBeenCalledWith('games/legacy-bot-fill-test', expect.objectContaining({
      hostUid: 'host-1',
      playerUids: { Player1: 'host-1', Player2: 'user-2', Player3: null, Player4: null },
      bots: ['Player3', 'Player4'],
    }));
  });

  it('bases the visible countdown on turn start instead of the last action', () => {
    const now = 1000 + TURN_TIMEOUT_MS - 1;
    const countdownState = {
      ...createBaseOnlineState(),
      turnStartedAt: 1000,
      lastActionTime: now,
    };

    expect(getTurnRemainingMs(countdownState, now)).toBe(1);
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
    const now = 2000 + OFFLINE_TURN_TIMEOUT_MS - 1;
    const offlineState = {
      ...createBaseOnlineState(),
      isOnline: false,
      turnStartedAt: 2000,
      lastActionTime: 2000,
    };

    expect(getTurnTimeoutMs(offlineState)).toBe(OFFLINE_TURN_TIMEOUT_MS);
    expect(getTurnRemainingMs(offlineState, now)).toBe(1);
  });

  it('blocks gameplay mutations after the game is finished', () => {
    const finishedState = {
      ...createBaseOnlineState(),
      status: 'finished',
      turnStartedAt: 1000,
      lastActionTime: 1000,
    };

    const reducedState = gameReducer(finishedState, {
      type: ACTION_TYPES.ROLL_DICE,
      payload: { d1: 4, d2: 4, sum: 8 },
    });

    expect(reducedState).toBe(finishedState);
  });

  it('does not refresh activity timestamps for blocked finished-game actions', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(9000);
    const finishedState = {
      ...createBaseOnlineState(),
      status: 'finished',
      turnStartedAt: 1000,
      lastActionTime: 1000,
    };
    const action = {
      type: ACTION_TYPES.END_TURN,
      _updateActivity: true,
    };

    const processedState = applyReducerPostProcessing(gameReducer(finishedState, action), action);

    expect(processedState).toBe(finishedState);
    expect(processedState.turnStartedAt).toBe(1000);
    expect(processedState.lastActionTime).toBe(1000);

    dateNowSpy.mockRestore();
  });

  it('ignores stale cached online state when hydrating a local offline game', () => {
    const offlineInitialState = {
      currentPlayer: 'Player1',
      turnQueue: [],
      hasRolledThisTurn: false,
      rollingPhaseComplete: false,
      players: {
        Player1: { color: 'ruby', name: 'Alice', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player2: { color: 'sapphire', name: 'Bot', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
      },
      isOnline: false,
      turnStartedAt: 1000,
      lastActionTime: 1000,
      afkStrikes: {},
      isAfkTurn: false,
    };

    localStorage.setItem('dyut_player_count', '2');
    localStorage.setItem('dyut_game_state', JSON.stringify({
      ...offlineInitialState,
      isOnline: true,
      afkStrikes: { Player1: 3 },
      isAfkTurn: true,
    }));

    const hydratedState = initGameState(offlineInitialState);

    expect(hydratedState).toBe(offlineInitialState);
    expect(localStorage.getItem('dyut_game_state')).toBeNull();
    expect(localStorage.getItem('dyut_player_count')).toBeNull();
  });

  it('ignores orphaned cached state when offline resume metadata is missing', () => {
    const offlineInitialState = {
      currentPlayer: 'Player1',
      turnQueue: [],
      hasRolledThisTurn: false,
      rollingPhaseComplete: false,
      players: {
        Player1: { color: 'ruby', name: 'Alice', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player2: { color: 'sapphire', name: 'Bot', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
      },
      isOnline: false,
      turnStartedAt: 1000,
      lastActionTime: 1000,
      afkStrikes: {},
      isAfkTurn: false,
    };

    localStorage.setItem('dyut_game_state', JSON.stringify({
      ...offlineInitialState,
      afkStrikes: { Player1: 1 },
    }));

    const hydratedState = initGameState(offlineInitialState);

    expect(hydratedState).toBe(offlineInitialState);
    expect(localStorage.getItem('dyut_game_state')).toBeNull();
  });

  it('marks an online match finished when fewer than two human players remain', () => {
    const onlineState = {
      ...createBaseOnlineState(),
    };

    const updates = buildPublicPresenceLossUpdates(onlineState, ['Player2']);

    expect(updates).toEqual({ status: 'finished', winnerPlayerId: 'Player2' });
  });

  it('settles a completed public match once using all paid participant UIDs', async () => {
    economyContextMocks.settlePublicMatch.mockClear();

    render(React.createElement(
      GameProvider,
      {
        gameConfig: {
          playerCount: 2,
          activeSeats: ['Player1', 'Player2'],
          playerColors: ['ruby', 'sapphire'],
          playerAliases: { Player1: 'Alice', Player2: 'Bob' },
          playerUids: { Player1: 'user-1', Player2: 'user-2' },
          bots: [],
          isOnline: true,
          isPublic: true,
          gameId: 'paid-match',
          hostUid: 'user-1',
          localUid: 'user-1',
          initialStateOverride: {
            status: 'finished',
            winnerPlayerId: 'Player1',
          },
        },
      },
      React.createElement('div'),
    ));

    await waitFor(() => expect(economyContextMocks.settlePublicMatch).toHaveBeenCalledOnce());
    expect(economyContextMocks.settlePublicMatch).toHaveBeenCalledWith({
      matchId: 'paid-match',
      participantCount: 2,
      didWin: true,
      isDraw: false,
    });
  });

  it('keeps an online match alive while at least two human players remain', () => {
    const onlineState = {
      ...createBaseOnlineState(),
      players: {
        ...createBaseOnlineState().players,
        Player3: { color: 'emerald', name: 'Cara', hasKilled: false, pieces: [0, -1, -1, -1], team: 0 },
      },
      playerUids: { Player1: 'user-1', Player2: 'user-2', Player3: 'user-3' },
    };

    const updates = buildPublicPresenceLossUpdates(onlineState, ['Player2', 'Player3']);

    expect(updates).toEqual({});
  });
});

const BotRollFallbackProbe = () => {
  const { state } = useGame();
  return React.createElement('output', { 'data-testid': 'bot-roll-count' }, state.turnQueue.length);
};

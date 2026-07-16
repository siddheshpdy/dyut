import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIBot } from './useAIBot';
import { getActiveTurnPlayerId, isGameOverState, useGame } from './GameContext';
import { getBestAIMove } from './aiLogic';

vi.mock('./GameContext', () => ({
  useGame: vi.fn(),
  isGameOverState: vi.fn(() => false),
  getActiveTurnPlayerId: vi.fn((state) => state.currentPlayer),
}));

vi.mock('./aiLogic', () => ({
  getBestAIMove: vi.fn(() => null),
}));

function BotHarness({ botPlayerIds, onAutoRoll }) {
  useAIBot(botPlayerIds, 'hard', onAutoRoll);
  return null;
}

describe('useAIBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    isGameOverState.mockReturnValue(false);
    getActiveTurnPlayerId.mockImplementation((state) => state.currentPlayer);
    getBestAIMove.mockReturnValue(null);
  });

  it('dispatches the best move once the bot can no longer roll', () => {
    const bestMove = { type: 'MOVE_WITH_FULL_ROLL', payload: { pieceIndex: 0, rollIndex: 0, distance: 4 } };
    getBestAIMove.mockReturnValue(bestMove);
    const dispatch = vi.fn();

    useGame.mockReturnValue({
      state: {
        currentPlayer: 'Player1',
        players: { Player1: { name: 'Alice' } },
        hasRolledThisTurn: true,
        rollingPhaseComplete: true,
        turnQueue: [{ d1: 4, d2: null, sum: 4 }],
        isOnline: true,
        hostUid: 'host-1',
        localUid: 'host-1',
      },
      dispatch,
    });

    render(<BotHarness botPlayerIds={['Player1']} />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(dispatch).toHaveBeenCalledWith({ ...bestMove, _autoControlledAction: true });
  });

  it('does not dispatch bot moves after the game is over', () => {
    const dispatch = vi.fn();
    isGameOverState.mockReturnValue(true);

    useGame.mockReturnValue({
      state: {
        currentPlayer: 'Player1',
        players: { Player1: { name: 'Alice' } },
        hasRolledThisTurn: true,
        rollingPhaseComplete: true,
        turnQueue: [{ d1: 4, d2: null, sum: 4 }],
        isOnline: true,
        hostUid: 'host-1',
        localUid: 'host-1',
      },
      dispatch,
    });

    render(<BotHarness botPlayerIds={['Player1']} />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(getBestAIMove).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not let a finished bot seat control its human teammate', () => {
    const dispatch = vi.fn();
    getActiveTurnPlayerId.mockReturnValue('Player3');

    useGame.mockReturnValue({
      state: {
        currentPlayer: 'Player1',
        players: { Player1: { name: 'Bot' }, Player3: { name: 'Human teammate' } },
        hasRolledThisTurn: true,
        rollingPhaseComplete: true,
        turnQueue: [{ d1: 4, d2: null, sum: 4 }],
        isOnline: false,
      },
      dispatch,
    });

    render(<BotHarness botPlayerIds={['Player1']} />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(getBestAIMove).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('lets a bot teammate play for a finished human seat', () => {
    const bestMove = { type: 'MOVE_WITH_FULL_ROLL', payload: { pieceIndex: 0, rollIndex: 0, distance: 4 } };
    const dispatch = vi.fn();
    getActiveTurnPlayerId.mockReturnValue('Player3');
    getBestAIMove.mockReturnValue(bestMove);

    useGame.mockReturnValue({
      state: {
        currentPlayer: 'Player1',
        players: { Player1: { name: 'Human' }, Player3: { name: 'Bot teammate' } },
        hasRolledThisTurn: true,
        rollingPhaseComplete: true,
        turnQueue: [{ d1: 4, d2: null, sum: 4 }],
        isOnline: false,
      },
      dispatch,
    });

    render(<BotHarness botPlayerIds={['Player3']} />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(getBestAIMove).toHaveBeenCalledWith('Player3', expect.any(Object), 'hard');
    expect(dispatch).toHaveBeenCalledWith({ ...bestMove, _autoControlledAction: true });
  });
});

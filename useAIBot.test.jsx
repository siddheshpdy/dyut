import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIBot } from './useAIBot';
import { isGameOverState, useGame } from './GameContext';
import { getBestAIMove } from './aiLogic';

vi.mock('./GameContext', () => ({
  useGame: vi.fn(),
  isGameOverState: vi.fn(() => false),
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
});

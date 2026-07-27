import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VictoryScreen from './VictoryScreen';

const economyMocks = vi.hoisted(() => ({
  lastSettlement: null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));

vi.mock('./audio', () => ({
  dispatchMuteState: vi.fn()
}));

vi.mock('./EconomyContext', () => ({
  useOptionalEconomy: () => economyMocks,
}));

describe('VictoryScreen', () => {
  it('starts a new game and exposes a separate home action', () => {
    const onNewGame = vi.fn();
    const onHome = vi.fn();

    render(<VictoryScreen winnerId="Alice" onNewGame={onNewGame} onHome={onHome} />);

    expect(screen.queryByText('playAgain')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'newGame' }));
    fireEvent.click(screen.getByRole('button', { name: 'home' }));

    expect(onNewGame).toHaveBeenCalledOnce();
    expect(onHome).toHaveBeenCalledOnce();
  });

  it('shows the per-teammate payout for a settled public 2v2 match', () => {
    economyMocks.lastSettlement = {
      matchId: 'TEAM-MATCH',
      grossPool: 2000,
      matchFee: 200,
      winnerCount: 2,
      prizePerWinner: 900,
      payout: 900,
    };

    render(
      <VictoryScreen
        winnerId="Team 1"
        matchId="TEAM-MATCH"
        isPublicMatch
        onNewGame={vi.fn()}
      />,
    );

    expect(screen.getByTestId('public-match-settlement')).toHaveTextContent('+900');
    expect(screen.getByTestId('public-match-settlement')).toHaveTextContent('teamPrizeSettlement');

    economyMocks.lastSettlement = null;
  });
});

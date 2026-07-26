import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VictoryScreen from './VictoryScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));

vi.mock('./audio', () => ({
  dispatchMuteState: vi.fn()
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
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DiceTray from './DiceTray';
import { useGame } from './GameContext';

// Mock hooks and dependencies
vi.mock('./GameContext', () => ({
    useGame: vi.fn(),
    ACTION_TYPES: { ROLL_DICE: 'ROLL_DICE', END_TURN: 'END_TURN', CLEAR_QUEUE: 'CLEAR_QUEUE' }
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }) // Returns the translation key as plain text
}));
vi.mock('./audio', () => ({ playSound: vi.fn() }));
vi.mock('./useAIBot', () => ({ useAIBot: vi.fn() }));
vi.mock('./gameLogic', () => ({
    hasAnyPlayableMove: vi.fn(() => true),
    getAutoMove: vi.fn(() => null)
}));

describe('DiceTray Component', () => {
    const mockDispatch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the active player name and roll button', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);
        
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('rollDice')).toBeInTheDocument();
        
        // The roll button should be enabled since the queue is empty
        const rollBtn = screen.getByRole('button', { name: 'rollDice' });
        expect(rollBtn).not.toBeDisabled();
    });
});
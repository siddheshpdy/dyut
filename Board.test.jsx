import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Board from './Board';
import { useGame } from './GameContext';

// Mock dependencies to isolate the Board rendering
vi.mock('./GameContext', () => ({
    useGame: vi.fn(),
    ACTION_TYPES: {}
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));
vi.mock('./audio', () => ({ playSound: vi.fn() }));
vi.mock('./usePrevious', () => ({ usePrevious: vi.fn(() => null) }));

// Keep the mock board small for performance
vi.mock('./boardMapping', () => ({
    generateBoardCells: () => [{ id: 'CENTER', isSafe: false, gridCol: '10', gridRow: '10' }],
    PLAYER_PATHS: { Player1: [], Player2: [] },
    isSafeZone: vi.fn()
}));
vi.mock('./gameLogic', () => ({
    getProxyPlayerId: vi.fn((id) => id),
    getValidMoves: vi.fn(),
    canSpawnPiece: vi.fn(),
    getPairShieldTarget: vi.fn()
}));

// Mock the VictoryScreen so we can easily test if it was triggered
vi.mock('./VictoryScreen', () => ({
    default: ({ winnerId }) => <div data-testid="victory-screen">Winner: {winnerId}</div>
}));

describe('Board Component', () => {
    it('renders player bases correctly and displays Team Mode indicators', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: {
                    Player1: { name: 'Alice', color: 'ruby', pieces: [-1, -1, -1, -1], hasKilled: false, team: 1 },
                    Player2: { name: 'Bob', color: 'sapphire', pieces: [-1, -1, -1, -1], hasKilled: false, team: 2 }
                },
                turnQueue: [],
                isTeamMode: true
            },
            dispatch: vi.fn()
        });

        render(<Board onGoToMenu={vi.fn()} />);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        
        // Should show team badges because isTeamMode is true
        expect(screen.getByText('T1')).toBeInTheDocument();
        expect(screen.getByText('T2')).toBeInTheDocument();
    });
});
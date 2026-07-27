import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Board from './Board';
import { useGame } from './GameContext';

// Mock dependencies to isolate the Board rendering
vi.mock('./GameContext', () => ({
    useGame: vi.fn(),
    ACTION_TYPES: {},
    getActiveTurnPlayerId: vi.fn((state) => state.currentPlayer),
    isActiveTurnAutoControlledForLocalClient: vi.fn(() => false),
    canLocalClientAct: vi.fn(() => true),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key })
}));
vi.mock('./audio', () => ({ getEffectiveMuteState: vi.fn(() => false), playSound: vi.fn() }));
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

    it('renders long player names above the base with ellipsis styling', () => {
        const longPlayerName = 'A Very Long CrazyGames Player Name';
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: {
                    Player1: { name: longPlayerName, color: 'ruby', pieces: [-1, -1, -1, -1], hasKilled: false, team: 0 }
                },
                turnQueue: [],
                isTeamMode: false
            },
            dispatch: vi.fn()
        });

        render(<Board onGoToMenu={vi.fn()} layoutMode="mobile" hideActiveBaseOnMobile={false} />);

        const nameLabel = screen.getByTitle(longPlayerName);
        expect(nameLabel).toHaveClass('min-w-0', 'flex-1', 'truncate');
        expect(nameLabel.parentElement.nextElementSibling).toHaveAttribute('data-player-base-card', 'Player1');
    });

    it('allows duplicate piece designs while preserving unique seat colors', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: {
                    Player1: { name: 'Alice', color: 'ruby', pieceSkinId: 'lotus', pieces: [-1, -1, -1, -1], hasKilled: false, team: 0 },
                    Player2: { name: 'Bob', color: 'sapphire', pieceSkinId: 'lotus', pieces: [-1, -1, -1, -1], hasKilled: false, team: 0 }
                },
                turnQueue: [],
                isTeamMode: false
            },
            dispatch: vi.fn()
        });

        const { container } = render(<Board onGoToMenu={vi.fn()} />);
        const lotusPieces = [...container.querySelectorAll('[data-piece-skin="lotus"]')];

        expect(lotusPieces).toHaveLength(8);
        expect(new Set(lotusPieces.map((piece) => piece.dataset.seatColor))).toEqual(new Set(['ruby', 'sapphire']));
    });

    it('shows the remaining human as winner when an online match ends by takeover', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player2',
                players: {
                    Player1: { name: 'Alice', color: 'ruby', pieces: [0, -1, -1, -1], hasKilled: false, team: 0 },
                    Player2: { name: 'Bot', color: 'sapphire', pieces: [0, -1, -1, -1], hasKilled: false, team: 0 }
                },
                turnQueue: [],
                isTeamMode: false,
                isOnline: true,
                status: 'finished',
                winnerPlayerId: 'Player1'
            },
            dispatch: vi.fn()
        });

        render(<Board onGoToMenu={vi.fn()} />);

        expect(screen.getByTestId('victory-screen')).toHaveTextContent('Winner: Alice');
    });
});

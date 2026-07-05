import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DiceTray from './DiceTray';
import { isActiveTurnAutoControlledForLocalClient, isGameOverState, useGame } from './GameContext';
import { useAIBot } from './useAIBot';
import { playSound } from './audio';

// Mock hooks and dependencies
vi.mock('./GameContext', () => ({
    useGame: vi.fn(),
    ACTION_TYPES: { ROLL_DICE: 'ROLL_DICE', END_TURN: 'END_TURN', CLEAR_QUEUE: 'CLEAR_QUEUE' },
    TURN_TIMER_WARNING_MS: 10000,
    AFK_BOT_TAKEOVER_STRIKES: 6,
    getActiveTurnPlayerId: vi.fn((state) => state.currentPlayer),
    getTurnRemainingMs: vi.fn(() => 15000),
    getTurnTimeoutMs: vi.fn(() => 30000),
    isActiveTurnAutoControlledForLocalClient: vi.fn(() => false),
    isGameOverState: vi.fn(() => false),
    canLocalClientAct: vi.fn(() => true),
    doesLocalClientOwnActiveTurn: vi.fn(() => true),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }) // Returns the translation key as plain text
}));
vi.mock('./audio', () => ({ playSound: vi.fn() }));
vi.mock('./useAIBot', () => ({ useAIBot: vi.fn() }));
vi.mock('./gameLogic', () => ({
    hasAnyPlayableMove: vi.fn(() => true),
    getAutoMove: vi.fn(() => null),
    getProxyPlayerId: vi.fn((id) => id)
}));

describe('DiceTray Component', () => {
    const mockDispatch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        isActiveTurnAutoControlledForLocalClient.mockReturnValue(false);
        isGameOverState.mockReturnValue(false);
    });

    it('renders the active player name and uses the desktop dice panel as the roll control', () => {
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
        const rollBtn = screen.getByRole('button', { name: 'rollDice' });
        expect(rollBtn).toHaveAttribute('id', 'dice-roll-btn');
        expect(rollBtn).not.toBeDisabled();
    });

    it('uses a tappable dice panel instead of a roll button on mobile', () => {
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

        render(<DiceTray layoutMode="mobile" />);

        expect(screen.queryByRole('button', { name: 'rollDice' })).not.toBeInTheDocument();
        const mobileRollSurface = screen.getByRole('button', { name: 'tapDiceToRoll' });
        expect(mobileRollSurface).toBeInTheDocument();
        expect(mobileRollSurface).toHaveAttribute('id', 'dice-roll-btn');
    });

    it('shows AFK strike warning progress for the active online player', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                isOnline: true,
                afkStrikes: { Player1: 2 },
                bots: []
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        expect(screen.getByText('afkStrikesLabel')).toBeInTheDocument();
        expect(screen.getByText('2 / 6')).toBeInTheDocument();
    });

    it('keeps the dice panel programmatically enabled for bot automation on auto-controlled turns', () => {
        isActiveTurnAutoControlledForLocalClient.mockReturnValue(true);
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                bots: ['Player1']
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        expect(screen.getByRole('button', { name: 'currentDice' })).not.toBeDisabled();
    });

    it('keeps bot automation inputs stable across countdown re-renders', () => {
        vi.useFakeTimers();
        isActiveTurnAutoControlledForLocalClient.mockReturnValue(true);
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                bots: [],
                turnStartedAt: 1000,
                isOnline: true,
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        const initialBotPlayers = useAIBot.mock.calls[0][0];

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(useAIBot.mock.calls.length).toBeGreaterThan(1);
        expect(useAIBot.mock.calls[useAIBot.mock.calls.length - 1][0]).toBe(initialBotPlayers);
    });

    it('automatically starts rolling on an auto-controlled turn after the tray delay', () => {
        vi.useFakeTimers();
        isActiveTurnAutoControlledForLocalClient.mockReturnValue(true);
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                bots: [],
                isOnline: true,
                turnStartedAt: 1000,
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        act(() => {
            vi.advanceTimersByTime(800);
        });

        expect(playSound).toHaveBeenCalledTimes(1);
    });

    it('auto-rolls a local-owned AFK turn with automation metadata', () => {
        vi.useFakeTimers();
        isActiveTurnAutoControlledForLocalClient.mockReturnValue(false);
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                bots: [],
                isOnline: true,
                isAfkTurn: true,
                turnStartedAt: 1000,
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        act(() => {
            vi.advanceTimersByTime(2100);
        });

        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ROLL_DICE',
            _autoControlledAction: true,
        }));
    });

    it('does not auto-roll after the game is over', () => {
        vi.useFakeTimers();
        isActiveTurnAutoControlledForLocalClient.mockReturnValue(true);
        isGameOverState.mockReturnValue(true);
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                bots: ['Player1'],
                isOnline: true,
                turnStartedAt: 1000,
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        act(() => {
            vi.advanceTimersByTime(2100);
        });

        expect(playSound).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});

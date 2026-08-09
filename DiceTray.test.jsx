import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DiceTray from './DiceTray';
import { isGameOverState, shouldLocalClientAutoControlTurn, useGame } from './GameContext';
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
    shouldLocalClientAutoControlTurn: vi.fn(() => false),
    isGameOverState: vi.fn(() => false),
    canLocalClientAct: vi.fn(() => true),
    doesLocalClientOwnActiveTurn: vi.fn(() => true),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }) // Returns the translation key as plain text
}));
vi.mock('./audio', () => ({ getEffectiveMuteState: vi.fn(() => false), playSound: vi.fn() }));
vi.mock('./useAIBot', () => ({ useAIBot: vi.fn() }));
vi.mock('./gameLogic', () => ({
    hasAnyPlayableMove: vi.fn(() => true),
    getAutoMove: vi.fn(() => null),
    getProxyPlayerId: vi.fn((id) => id),
    canSpawnPiece: vi.fn(() => false)
}));

describe('DiceTray Component', () => {
    const mockDispatch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        shouldLocalClientAutoControlTurn.mockReturnValue(false);
        isGameOverState.mockReturnValue(false);
    });

    it('renders the active player name and uses the desktop dice panel as the roll control', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [{ d1: 4, d2: 4, sum: 8 }],
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
        const desktopDiceFaces = rollBtn.querySelectorAll('[data-die-face="ornate-desktop"]');
        expect(desktopDiceFaces).toHaveLength(2);
        desktopDiceFaces.forEach((face) => {
            expect(face).toHaveClass('aspect-square', 'h-[clamp(4.5rem,17dvh,8.75rem)]', 'flex-none');
        });
        expect(screen.getByText('4 + 4').parentElement).toHaveClass(
            'h-[clamp(2.5rem,7dvh,3.25rem)]',
            'min-w-[clamp(4.5rem,6vw,5.5rem)]',
            'text-[clamp(0.8rem,1.8dvh,1rem)]'
        );
        expect(document.querySelector('[data-dice-tray-section="controls"]')).toHaveClass('h-[70%]', 'min-h-[14rem]');
        expect(document.querySelector('[data-dice-tray-section="queue"]')).toHaveClass('h-[30%]', 'min-h-[5.25rem]');
    });

    it('keeps a long active player name within the desktop tray', () => {
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'SiddheshPatilLongPlayerName', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);

        const activeName = screen.getByText('SiddheshPatilLongPlayerName');
        expect(activeName).toHaveClass('max-w-[65%]', 'truncate');
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
        expect(mobileRollSurface).toHaveAttribute('data-mobile-dice-panel', 'true');
        expect(screen.getByText('currentDice')).toBeInTheDocument();
        expect(screen.getByText('tapDiceToRoll')).toHaveAttribute('data-mobile-roll-instruction', 'true');
        expect(mobileRollSurface.querySelector('[data-mobile-turn-progress="true"]')).toBeInTheDocument();
        expect(mobileRollSurface.querySelector('[data-die-face="ornate-compact"]')).toHaveClass('aspect-square', 'flex-none');
    });

    it('portals the Void Roll dialog above gameplay and keeps it viewport constrained', () => {
        vi.useFakeTimers();
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        useGame.mockReturnValue({
            state: {
                currentPlayer: 'Player1',
                players: { Player1: { name: 'Alice', color: 'ruby' } },
                turnQueue: [],
                hasRolledThisTurn: false,
                rollingPhaseComplete: false,
                isVoidRuleEnabled: true,
                scriptedRolls: [{ d1: 1, d2: 3 }],
                scriptedRollIndex: 0,
                bots: []
            },
            dispatch: mockDispatch
        });

        render(<DiceTray />);
        fireEvent.click(screen.getByRole('button', { name: 'rollDice' }));

        act(() => {
            vi.advanceTimersByTime(1200);
        });

        const dialog = screen.getByRole('dialog', { name: 'voidRollTitle' });
        const overlay = dialog.closest('[data-void-roll-overlay="true"]');
        expect(overlay).toHaveClass('fixed', 'inset-0', 'z-[300]', 'overflow-y-auto');
        expect(overlay.parentElement).toBe(document.body);
        expect(dialog).toHaveClass('max-h-[calc(100dvh-1.5rem)]', 'overflow-y-auto');

        fireEvent.click(screen.getByRole('button', { name: 'acceptFate' }));
        expect(screen.queryByRole('dialog', { name: 'voidRollTitle' })).not.toBeInTheDocument();
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'END_TURN' });
        randomSpy.mockRestore();
    });

    it('stacks the active player above the dice in compact landscape mode', () => {
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

    render(<DiceTray layoutMode="compact" />);

    expect(screen.getByText('Alice')).toHaveClass('w-full', 'text-center');
    expect(screen.getByRole('button', { name: 'rollDice' })).toHaveClass('w-full', 'flex-1', 'min-h-0');
    expect(document.querySelector('[data-dice-tray-section="queue"]')).toHaveClass('w-full', 'min-h-0', 'flex-1');
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
        expect(screen.getByLabelText('afkStrikeWarning')).toHaveAttribute('title', 'afkStrikeWarning');
    });

    it('keeps the dice panel programmatically enabled for bot automation on auto-controlled turns', () => {
        shouldLocalClientAutoControlTurn.mockReturnValue(true);
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
        shouldLocalClientAutoControlTurn.mockReturnValue(true);
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
        shouldLocalClientAutoControlTurn.mockReturnValue(true);
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
        shouldLocalClientAutoControlTurn.mockReturnValue(true);
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
        shouldLocalClientAutoControlTurn.mockReturnValue(true);
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

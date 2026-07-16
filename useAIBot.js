import { useEffect } from 'react';
import { getActiveTurnPlayerId, isGameOverState, useGame } from './GameContext';
import { getBestAIMove } from './aiLogic';

export function useAIBot(botPlayerIds = [], difficulty = 'hard') {
    const { state, dispatch } = useGame();
    const isGameOver = isGameOverState(state);

    useEffect(() => {
        if (!state.players) return;
        if (isGameOver) return;

        // Phase 17.4: Only the Host should execute Bot logic to prevent multiple overlapping writes
        if (state.isOnline && state.hostUid !== state.localUid) return;

        const activePlayerId = getActiveTurnPlayerId(state);
        const isBotTurn = botPlayerIds.includes(activePlayerId);
        if (!isBotTurn) return;

        const actionTimer = setTimeout(() => {
            const canRoll = !state.hasRolledThisTurn || !state.rollingPhaseComplete;

            // 1. Wait for the tray-owned auto-roll path to finish first
            if (canRoll) return;

            // 2. Wait if currently processing dice physics or a void roll
            if (state.turnQueue.length === 0) return;

            // 3. Request logic layer for the optimal move and execute with view transitions
            const action = getBestAIMove(activePlayerId, state, difficulty);
            if (action) {
                dispatch({ ...action, _autoControlledAction: true });
            }
        }, 800); // Wait 800ms to simulate "thinking" and make tracking moves easier for humans

        return () => clearTimeout(actionTimer);
    }, [state, botPlayerIds, difficulty, dispatch, isGameOver]);
}

import { getValidMoves, canSpawnPiece, willMoveKill, getOccupantsOfPathIndex, getPairShieldTarget, getProxyPlayerId } from './gameLogic';
import { PLAYER_PATHS, isSafeZone as isCellVisuallySafe } from './boardMapping';
import { ACTION_TYPES } from './GameContext';

// Heuristic Scoring Weights defined from Phase 13 plan
const AI_WEIGHTS = {
    FINISH: 200,
    KILL: 100,
    SPAWN: 50,
    HOME_STRETCH: 40,
    PAIR_SHIELD: 30,
    BREAK_PAIR_SHIELD: 250, // Massive reward for wiping out two opponent pieces
    SAFE_ZONE: 20,
    DISTANCE: 1, // 1 point per square moved
    LEAVE_SAFE_ZONE: -15,
};

function evaluateMove(playerId, currentPos, targetPos, state) {
    let score = 0;
    score += (targetPos - currentPos) * AI_WEIGHTS.DISTANCE;

    const path = PLAYER_PATHS[playerId];
    if (targetPos >= path.length - 1) return score + AI_WEIGHTS.FINISH;

    const targetCellId = path[targetPos];
    const isSafe = targetCellId && targetCellId.match(/arm_(\d+)_col_(\d+)_row_(\d+)/) ? isCellVisuallySafe(Number(RegExp.$2), Number(RegExp.$3)) : false;

    if (willMoveKill(targetPos, playerId, state)) score += AI_WEIGHTS.KILL;
    if (isSafe) score += AI_WEIGHTS.SAFE_ZONE;
    if (targetCellId && targetCellId.includes('_HOME')) score += AI_WEIGHTS.HOME_STRETCH;

    // Detect forming a pair shield
    const occupants = getOccupantsOfPathIndex(targetPos, playerId, state.players);
    if (occupants.length === 1 && occupants[0].playerId === playerId) score += AI_WEIGHTS.PAIR_SHIELD;

    // Penalty for abandoning a safe zone
    const currentCellId = path[currentPos];
    const wasSafe = currentCellId && currentCellId.match(/arm_(\d+)_col_(\d+)_row_(\d+)/) ? isCellVisuallySafe(Number(RegExp.$2), Number(RegExp.$3)) : false;
    if (wasSafe) score += AI_WEIGHTS.LEAVE_SAFE_ZONE;

    return score;
}

export function getBestAIMove(originalPlayerId, state, difficulty = 'hard') {
    const playerId = getProxyPlayerId(originalPlayerId, state);
    const player = state.players[playerId];
    if (!player || state.turnQueue.length === 0) return null;

    const activeRoll = state.turnQueue[0];
    const isDouble = activeRoll.d1 === activeRoll.d2 && activeRoll.d2 !== null;
    let possibleMoves = [];

    // 1. Spawning Check
    if (isDouble) {
        const lockedIndex = player.pieces.findIndex(p => p === -1);
        if (lockedIndex !== -1 && canSpawnPiece(playerId, activeRoll.sum, state)) {
            possibleMoves.push({ action: { type: ACTION_TYPES.SPAWN_PIECE, payload: { playerId, pieceIndex: lockedIndex, rollIndex: 0 } }, score: AI_WEIGHTS.SPAWN });
        }
    }

    // 1.5 Pair Attack Check (Requires a double roll and two pieces that can reach the target)
    if (isDouble) {
        const moveDistance = activeRoll.d1;
        for (let i = 0; i < player.pieces.length; i++) {
            const pos1 = player.pieces[i];
            if (pos1 !== -1 && pos1 !== 999) {
                const targetPos = pos1 + moveDistance;
                const defenderId = getPairShieldTarget(targetPos, playerId, state);
                
                if (defenderId) {
                    const targetCellId = PLAYER_PATHS[playerId][targetPos];
                    const parts = targetCellId?.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
                    let isTargetSafe = false;
                    if (parts) {
                        const [, , col, row] = parts.map(Number);
                        isTargetSafe = isCellVisuallySafe(col, row);
                    }
                    
                    // A Pair Shield on an 'X' safe zone cannot be broken by a split-pair attack
                    if (!isTargetSafe) {
                        // Find a partner piece to execute the coordinated attack
                        for (let j = i + 1; j < player.pieces.length; j++) {
                            const pos2 = player.pieces[j];
                            if (pos2 !== -1 && pos2 !== 999 && (pos2 + moveDistance === targetPos)) {
                                const combinedBaseScore = evaluateMove(playerId, pos1, targetPos, state) + evaluateMove(playerId, pos2, targetPos, state);
                                possibleMoves.push({ action: { type: ACTION_TYPES.EXECUTE_PAIR_ATTACK, payload: { playerId, rollIndex: 0, firstPieceIndex: i, secondPieceIndex: j, targetCellId } }, score: AI_WEIGHTS.BREAK_PAIR_SHIELD + combinedBaseScore });
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Movement Check
    player.pieces.forEach((pos, pieceIndex) => {
        if (pos !== -1 && pos !== 999) {
            const validMoves = getValidMoves(pos, activeRoll, playerId, state);
            
            if (activeRoll.d2 === null) { // Partial Roll
                if (validMoves.sum) possibleMoves.push({ action: { type: ACTION_TYPES.MOVE_WITH_FULL_ROLL, payload: { playerId, pieceIndex, rollIndex: 0, distance: activeRoll.d1 } }, score: evaluateMove(playerId, pos, pos + activeRoll.d1, state) });
            } else { // Full Roll Options
                const high = Math.max(activeRoll.d1, activeRoll.d2);
                const low = Math.min(activeRoll.d1, activeRoll.d2);
                if (validMoves.sum) possibleMoves.push({ action: { type: ACTION_TYPES.MOVE_WITH_FULL_ROLL, payload: { playerId, pieceIndex, rollIndex: 0, distance: activeRoll.sum } }, score: evaluateMove(playerId, pos, pos + activeRoll.sum, state) });
                if (validMoves.high) possibleMoves.push({ action: { type: ACTION_TYPES.MOVE_AND_SPLIT_ROLL, payload: { playerId, pieceIndex, rollIndex: 0, distanceUsed: high } }, score: evaluateMove(playerId, pos, pos + high, state) });
                if (validMoves.low) possibleMoves.push({ action: { type: ACTION_TYPES.MOVE_AND_SPLIT_ROLL, payload: { playerId, pieceIndex, rollIndex: 0, distanceUsed: low } }, score: evaluateMove(playerId, pos, pos + low, state) });
            }
        }
    });

    if (possibleMoves.length === 0) return null;
    if (difficulty === 'easy') return possibleMoves[Math.floor(Math.random() * possibleMoves.length)].action;

    possibleMoves.sort((a, b) => b.score - a.score);
    
    // Artificial Humanization: 15% chance to pick the 2nd best move (simulating a human mistake/oversight)
    if (difficulty === 'hard' && possibleMoves.length > 1 && Math.random() < 0.15) {
        return possibleMoves[1].action;
    }

    return possibleMoves[0].action; // Return best calculated move
}
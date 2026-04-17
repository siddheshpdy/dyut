import { PLAYER_PATHS, isSafeZone as isCellVisuallySafe } from './boardMapping';

/**
 * Gets all pieces currently occupying a specific logical path index for a given player.
 * This is the core function for collision detection.
 * @param {number} targetPathIndex - The logical index on the player's path.
 * @param {string} checkingPlayerId - The ID of the player whose path we are checking.
 * @param {object} allPlayersState - The entire `state.players` object.
 * @returns {Array} - An array of occupant objects { playerId, pieceIndex }.
 */
export function getOccupantsOfPathIndex(targetPathIndex, checkingPlayerId, allPlayersState) {
    const occupants = [];
    if (targetPathIndex < 0) return occupants;

    // Get the visual cell ID for the target index from the checking player's path
    const targetCellId = PLAYER_PATHS[checkingPlayerId][targetPathIndex];
    if (!targetCellId || targetCellId.startsWith('CENTER')) return occupants; // Don't check center goal

    // Now, check all players to see if any of their pieces map to the same visual cell ID
    for (const [playerId, player] of Object.entries(allPlayersState)) {
        for (const [pieceIndex, piecePos] of player.pieces.entries()) {
            if (piecePos !== -1) {
                const occupantCellId = PLAYER_PATHS[playerId][piecePos];
                if (occupantCellId === targetCellId) {
                    occupants.push({ playerId, pieceIndex });
                }
            }
        }
    }
    return occupants;
}

/**
 * Checks if a target path index is a pair shield.
 * @param {number} targetPathIndex - The destination index on the player's path.
 * @param {string} movingPlayerId - The ID of the player attempting to move.
 * @param {object} allPlayersState - The entire `state.players` object.
 * @returns {string|null} - The ID of the defending player if it's a pair shield, otherwise null.
 */
export function getPairShieldTarget(targetPathIndex, movingPlayerId, allPlayersState) {
    const occupants = getOccupantsOfPathIndex(targetPathIndex, movingPlayerId, allPlayersState);
    if (occupants.length === 2 && occupants[0].playerId === occupants[1].playerId && occupants[0].playerId !== movingPlayerId) {
        return occupants[0].playerId;
    }
    return null;
}

/**
 * Checks if a target square is blocked for a given player.
 * @param {number} targetPathIndex - The destination index on the player's path.
 * @param {string} movingPlayerId - The ID of the player attempting to move.
 * @param {object} state - The entire global game state.
 * @returns {boolean} - True if the square is blocked, false otherwise.
 */
function isSquareBlocked(targetPathIndex, movingPlayerId, state) {
    const path = PLAYER_PATHS[movingPlayerId];
    
    // 1. Exact Finish Rule: Block any move that overshoots the final square
    if (targetPathIndex >= path.length) {
        return true;
    }

    const targetCellId = path[targetPathIndex];

    // 2. Check for Blood Debt (Cannot enter HOME or FINISHED without a kill)
    if (targetCellId && (targetCellId.includes('_HOME') || targetCellId.includes('CENTER_FINISHED'))) {
        if (!state.players[movingPlayerId].hasKilled) {
            return true; // Blocked due to Blood Debt
        }
    }

    const occupants = getOccupantsOfPathIndex(targetPathIndex, movingPlayerId, state.players);

    // 2. Check for Pair Shield (2 pieces of the same opponent color)
    if (occupants.length === 2 && occupants[0].playerId === occupants[1].playerId && occupants[0].playerId !== movingPlayerId) {
        return true; // Blocked by a pair shield
    }

    // 3. Check for general occupancy limit
    if (occupants.length >= 2) {
        return true; // Blocked because the square is full
    }

    // 4. Check for Safe Zone blocking
    if (occupants.length === 1 && occupants[0].playerId !== movingPlayerId) {
        // This is a bit tricky. We need the visual col/row from the cell ID.
        const parts = targetCellId.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
        if (parts) {
            const [, , col, row] = parts.map(Number);
            if (isCellVisuallySafe(col, row)) {
                return true; // Blocked by a single opponent on a safe zone
            }
        }
    }

    return false; // The square is not blocked
}


/**
 * Enforces the "Max Value Rule" to determine which moves are valid.
 * @param {number} pieceCurrentPos - The current path index of the piece.
 * @param {object} roll - The roll object, e.g., { d1, d2, sum }.
 * @param {string} playerId - The ID of the current player.
 * @param {object} state - The entire global game state.
 * @returns {object} - An object indicating validity, e.g., { sum: true, high: false, low: false }.
 */
export function getValidMoves(pieceCurrentPos, roll, playerId, state) {
    const high = Math.max(roll.d1, roll.d2);
    const low = Math.min(roll.d1, roll.d2);

    // Handle partial rolls (only one move possible)
    if (roll.d2 === null) {
        const isMoveValid = !isSquareBlocked(pieceCurrentPos + roll.d1, playerId, state);
        return { sum: isMoveValid, high: isMoveValid, low: isMoveValid }; // All flags map to the single move's validity
    }

    // TODO: Add logic for home stretch and winning moves (overshoot)
    
    const isSumValid = !isSquareBlocked(pieceCurrentPos + roll.sum, playerId, state);
    const isHighValid = !isSquareBlocked(pieceCurrentPos + high, playerId, state);
    const isLowValid = !isSquareBlocked(pieceCurrentPos + low, playerId, state);

    // The "Max Value Rule" is a strategic choice presented to the user.
    // By returning the validity of each move, we allow the UI to present all
    // possible choices for the selected piece, including splitting the roll.
    // If a user has a choice, they can pick a lower value to split the move.
    return {
        sum: isSumValid,
        high: isHighValid,
        low: isLowValid,
    };
}

/**
 * Evaluates if a piece is legally allowed to spawn on its designated target square.
 */
export function canSpawnPiece(playerId, spawnPos, state) {
    const targetCellId = PLAYER_PATHS[playerId][spawnPos];
    const occupants = getOccupantsOfPathIndex(spawnPos, playerId, state.players);
    
    // Cannot spawn if blocked by 2 of your own pieces
    const ownPieces = occupants.filter(o => o.playerId === playerId);
    if (ownPieces.length >= 2) return false;

    const opponentPieces = occupants.filter(o => o.playerId !== playerId);
    if (opponentPieces.length > 0) {
        let isTargetSafe = false;
        const parts = targetCellId?.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
        if (parts) {
            const [, , col, row] = parts.map(Number);
            isTargetSafe = isCellVisuallySafe(col, row);
        }
        // Cannot spawn onto an opponent on a safe zone UNLESS it's spot 8 or 12
        if (isTargetSafe && spawnPos !== 8 && spawnPos !== 12) {
            return false;
        }
    }
    return true;
}

/**
 * Checks if the current player has any valid move they can make with the rolls in the queue.
 * @param {string} playerId - The ID of the current player.
 * @param {object} state - The entire global game state.
 * @returns {boolean} - True if at least one move is possible.
 */
export function hasAnyPlayableMove(playerId, state) {
    const player = state.players[playerId];
    if (!player || state.turnQueue.length === 0) {
        return false;
    }

    for (const roll of state.turnQueue) {
        // 1. Check if a locked piece can be spawned
        if (roll.d1 === roll.d2 && roll.d2 !== null) { // It's a double, not a partial roll
            const hasLockedPiece = player.pieces.some(p => p === -1);
            if (hasLockedPiece && canSpawnPiece(playerId, roll.sum, state)) {
                return true;
            }
        }

        // 2. Check if any piece on the board can move
        for (const piecePos of player.pieces) {
            if (piecePos !== -1 && piecePos !== 999) { // Piece is on the board and not finished
                const validMoves = getValidMoves(piecePos, roll, playerId, state);
                if (validMoves.sum || validMoves.high || validMoves.low) {
                    return true; // Found a valid move
                }
            }
        }
    }

    return false; // No moves found for any piece with any roll
}

/**
 * Checks if landing on a specific square will result in a capture.
 */
export function willMoveKill(targetPathIndex, movingPlayerId, state) {
    const path = PLAYER_PATHS[movingPlayerId];
    if (targetPathIndex >= path.length) return false;
    
    const targetCellId = path[targetPathIndex];
    if (!targetCellId || targetCellId.startsWith('CENTER') || targetCellId.includes('_HOME')) {
        return false;
    }

    const occupants = getOccupantsOfPathIndex(targetPathIndex, movingPlayerId, state.players);
    return occupants.length === 1 && occupants[0].playerId !== movingPlayerId;
}

/**
 * Determines if an automatic move should be made.
 * Triggers only if exactly one piece has any valid moves. Prioritizes splitting a roll to capture.
 */
export function getAutoMove(playerId, state) {
    const player = state.players[playerId];
    if (!player || state.turnQueue.length === 0) return null;

    const hasRollsInQueue = state.turnQueue.length > 0;
    const lastQueuedRoll = hasRollsInQueue ? state.turnQueue[state.turnQueue.length - 1] : null;
    const isDoublesStreak = lastQueuedRoll ? lastQueuedRoll.d1 === lastQueuedRoll.d2 && lastQueuedRoll.d2 !== null : false;
    
    // Do not auto-move if they haven't finished rolling
    if (!state.hasRolledThisTurn || isDoublesStreak) return null;

    // Scan entire queue to find a playable roll if the first one is blocked
    for (let rollIndex = 0; rollIndex < state.turnQueue.length; rollIndex++) {
        const activeRoll = state.turnQueue[rollIndex];
        const isDouble = activeRoll.d1 === activeRoll.d2 && activeRoll.d2 !== null;
        
        let movablePieces = [];
        let lockedPieceAdded = false;

        player.pieces.forEach((pos, pieceIndex) => {
            if (pos === -1) {
                if (isDouble && !lockedPieceAdded && canSpawnPiece(playerId, activeRoll.sum, state)) {
                    movablePieces.push({ pieceIndex, type: 'SPAWN' });
                    lockedPieceAdded = true; // Group identical locked pieces as 1 choice
                }
            } else if (pos !== 999) {
                const validMoves = getValidMoves(pos, activeRoll, playerId, state);
                if (validMoves.sum || validMoves.high || validMoves.low) {
                    movablePieces.push({ pieceIndex, type: 'MOVE', pos, validMoves });
                }
            }
        });

        if (movablePieces.length === 1) {
            const move = movablePieces[0];
            if (move.type === 'SPAWN') {
                return { type: 'SPAWN_PIECE', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex } };
            } else {
                const { pos, validMoves } = move;
                
                if (activeRoll.d2 === null) { // Partial roll
                    if (validMoves.sum) return { type: 'MOVE_WITH_FULL_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distance: activeRoll.d1 } };
                    continue; // This partial roll is blocked, check next roll
                }

                const high = Math.max(activeRoll.d1, activeRoll.d2);
                const low = Math.min(activeRoll.d1, activeRoll.d2);
                
                // Strategic Priority: Check kills before resorting to the required Sum move
                const killsWithLow = validMoves.low && willMoveKill(pos + low, playerId, state);
                const killsWithHigh = validMoves.high && willMoveKill(pos + high, playerId, state);
                const killsWithSum = validMoves.sum && willMoveKill(pos + activeRoll.sum, playerId, state);

                // Strategic Priority 1: Captures take absolute precedence
                if (killsWithSum) return { type: 'MOVE_WITH_FULL_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distance: activeRoll.sum } };
                if (killsWithHigh) return { type: 'MOVE_AND_SPLIT_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distanceUsed: high } };
                if (killsWithLow) return { type: 'MOVE_AND_SPLIT_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distanceUsed: low } };
                
                // Strict Priority Resolution (No Captures Available)
                if (validMoves.sum) return { type: 'MOVE_WITH_FULL_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distance: activeRoll.sum } };
                if (validMoves.high) return { type: 'MOVE_AND_SPLIT_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distanceUsed: high } };
                if (validMoves.low) return { type: 'MOVE_AND_SPLIT_ROLL', payload: { playerId, pieceIndex: move.pieceIndex, rollIndex, distanceUsed: low } };
            }
        } else if (movablePieces.length > 1) {
            return null; // Player has multiple choices across pieces, abort auto-move
        }
    }
    return null;
}
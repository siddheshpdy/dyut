import { PLAYER_PATHS, isSafeZone as isCellVisuallySafe } from './boardMapping';

/**
 * Gets all pieces currently occupying a specific logical path index for a given player.
 * This is the core function for collision detection.
 * @param {number} targetPathIndex - The logical index on the player's path.
 * @param {string} checkingPlayerId - The ID of the player whose path we are checking.
 * @param {object} allPlayersState - The entire `state.players` object.
 * @returns {Array} - An array of occupant objects { playerId, pieceIndex }.
 */
function getOccupantsOfPathIndex(targetPathIndex, checkingPlayerId, allPlayersState) {
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
    const targetCellId = path[targetPathIndex];

    // 1. Check for Blood Debt (Cannot enter HOME or FINISHED without a kill)
    if (targetPathIndex >= path.length || (targetCellId && (targetCellId.includes('_HOME') || targetCellId.includes('CENTER_FINISHED')))) {
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
            if (hasLockedPiece) {
                // A double can always be used to spawn if a piece is locked.
                // We assume at least one spawn point is not fully blocked by two of the player's own pieces.
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
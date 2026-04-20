import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getValidMoves, canSpawnPiece, willMoveKill, getProxyPlayerId, getPairShieldTarget } from './gameLogic';

// Mock the boardMapping to control the exact grid environment for testing
vi.mock('./boardMapping', () => ({
    PLAYER_PATHS: {
        Player1: ['path0', 'path1', 'path2', 'path3', 'arm_0_col_0_row_0', 'path5', 'path6', 'path7', 'arm_0_col_8_row_8', 'path9', 'path10', 'path11', 'arm_0_col_12_row_12', 'path13', 'path14', 'Player1_HOME_1', 'CENTER'],
        Player2: ['path0', 'path1', 'path2', 'path3', 'arm_0_col_0_row_0', 'path5', 'path6', 'path7', 'arm_0_col_8_row_8', 'path9', 'path10', 'path11', 'arm_0_col_12_row_12', 'path13', 'path14', 'Player2_HOME_1', 'CENTER']
    },
    // Let's define the mock safe zones: indices 4, 8, and 12 are visually "safe" in this mock
    isSafeZone: vi.fn((col, row) => (col === 0 && row === 0) || (col === 8 && row === 8) || (col === 12 && row === 12))
}));

describe('Game Logic & Rules Engine', () => {
    let mockState;

    beforeEach(() => {
        // Reset to a clean game state before every single test
        mockState = {
            isTeamMode: false,
            turnQueue: [],
            players: {
                Player1: { team: 1, hasKilled: false, pieces: [-1, -1, -1, -1] },
                Player2: { team: 2, hasKilled: false, pieces: [-1, -1, -1, -1] },
                Player3: { team: 1, hasKilled: false, pieces: [-1, -1, -1, -1] }
            }
        };
    });

    describe('Blood Debt', () => {
        it('blocks a piece from entering the Home Stretch if hasKilled is false', () => {
            mockState.players.Player1.pieces = [14, -1, -1, -1]; // One square away from HOME_1
            
            const validMoves = getValidMoves(14, { d1: 1, d2: null, sum: 1 }, 'Player1', mockState);
            
            // Should be blocked
            expect(validMoves.sum).toBe(false);
        });

        it('allows a piece to enter the Home Stretch if hasKilled is true', () => {
            mockState.players.Player1.pieces = [14, -1, -1, -1];
            mockState.players.Player1.hasKilled = true; // Blood debt paid
            
            const validMoves = getValidMoves(14, { d1: 1, d2: null, sum: 1 }, 'Player1', mockState);
            
            // Should be allowed
            expect(validMoves.sum).toBe(true);
        });
    });

    describe('Assassin Rule (Spawning)', () => {
        it('allows a spawning piece to kill an opponent on Safe Zone 8', () => {
            // Opponent is sitting on safe zone at index 8
            mockState.players.Player2.pieces = [8, -1, -1, -1]; 
            
            // Player 1 attempts to spawn (using double 4s = sum 8)
            const canSpawn = canSpawnPiece('Player1', 8, mockState);
            
            expect(canSpawn).toBe(true);
        });

        it('prevents a normal moving piece from killing an opponent on Safe Zone 8', () => {
            mockState.players.Player1.pieces = [4, -1, -1, -1]; 
            mockState.players.Player2.pieces = [8, -1, -1, -1]; // Opponent on safe zone
            
            const validMoves = getValidMoves(4, { d1: 4, d2: null, sum: 4 }, 'Player1', mockState);
            
            expect(validMoves.sum).toBe(false); // Move is blocked
        });
    });

    describe('Pair Shields', () => {
        it('detects a Pair Shield when two pieces of the same color occupy a square', () => {
            // Player 2 has two pieces on index 5
            mockState.players.Player2.pieces = [5, 5, -1, -1];
            
            const targetId = getPairShieldTarget(5, 'Player1', mockState);
            expect(targetId).toBe('Player2');
        });

        it('blocks a normal single move from landing on a Pair Shield', () => {
            mockState.players.Player1.pieces = [2, -1, -1, -1];
            mockState.players.Player2.pieces = [5, 5, -1, -1]; // Shield on index 5
            
            const validMoves = getValidMoves(2, { d1: 3, d2: null, sum: 3 }, 'Player1', mockState);
            
            expect(validMoves.sum).toBe(false); // Move is blocked
        });
    });

    describe('Combat', () => {
        it('identifies a move that will result in a kill', () => {
            mockState.players.Player1.pieces = [2, -1, -1, -1];
            mockState.players.Player2.pieces = [5, -1, -1, -1]; // Single opponent on index 5
            
            const willKill = willMoveKill(5, 'Player1', mockState);
            
            expect(willKill).toBe(true);
        });

        it('does not register a kill when landing on a friendly piece', () => {
            mockState.players.Player1.pieces = [2, 5, -1, -1]; // Player 1 has pieces on 2 and 5
            
            const willKill = willMoveKill(5, 'Player1', mockState);
            
            expect(willKill).toBe(false);
        });
    });

    describe('Team Mode Proxy', () => {
        it('returns the teammate ID if the current player has finished all pieces', () => {
            mockState.isTeamMode = true;
            // Player 1 has finished the game
            mockState.players.Player1.pieces = [999, 999, 999, 999];
            // Player 3 (Teammate) is still playing
            mockState.players.Player3.pieces = [5, 10, -1, -1];

            const activePlayerId = getProxyPlayerId('Player1', mockState);
            
            expect(activePlayerId).toBe('Player3');
        });

        it('returns the original player ID if they have not finished', () => {
            mockState.isTeamMode = true;
            mockState.players.Player1.pieces = [999, 999, 999, 10]; // One piece left
            
            const activePlayerId = getProxyPlayerId('Player1', mockState);
            
            expect(activePlayerId).toBe('Player1');
        });
    });
});
import { PLAYER_PATHS } from './boardMapping';

// Helper to find the exact logical index for Player 2 that physically intersects with Player 1
const p2 = (p1Index) => {
  try {
    const visualId = PLAYER_PATHS['Player1'][p1Index];
    const idx = PLAYER_PATHS['Player2'].indexOf(visualId);
    return idx !== -1 ? idx : p1Index;
  } catch (e) {
    return p1Index;
  }
};

export const getTutorialScenarios = () => [
  {
    id: 'spawn',
    title: 'How to Spawn',
    description: 'You need a double roll (e.g., 4+4) to spawn a piece from your base onto the board. Click your highlighted base piece, then click "Spawn".',
    initialState: {
      currentPlayer: 'Player1',
      turnQueue: [{ d1: 4, d2: 4, sum: 8 }],
      players: {
        Player1: { color: 'ruby', name: 'You', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player2: { color: 'sapphire', name: 'Opponent', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player3: { color: 'emerald', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player4: { color: 'amber', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 }
      },
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      isTeamMode: false,
      isOnline: false,
      isQuickGame: false
    },
    expectedAction: ['SPAWN_PIECE'],
    successMessage: 'Great job! Your piece is now on the board.'
  },
  {
    id: 'move',
    title: 'Basic Movement',
    description: 'Select your piece on the board and choose how many spaces to move. You can use the full sum or split the dice between pieces.',
    initialState: {
      currentPlayer: 'Player1',
      turnQueue: [{ d1: 3, d2: 4, sum: 7 }],
      players: {
        Player1: { color: 'ruby', name: 'You', hasKilled: false, pieces: [8, -1, -1, -1], team: 0 }, // Starts where the spawn scenario left off
        Player2: { color: 'sapphire', name: 'Opponent', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player3: { color: 'emerald', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player4: { color: 'amber', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 }
      },
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      isTeamMode: false,
      isOnline: false,
      isQuickGame: false
    },
    expectedAction: ['MOVE_WITH_FULL_ROLL', 'MOVE_AND_SPLIT_ROLL'],
    successMessage: 'Excellent! Your piece moved forward.'
  },
  {
    id: 'capture',
    title: 'Capturing Opponents',
    description: 'Land exactly on an opponent\'s piece to capture it and send it back to their base. This pays your "Blood Debt", allowing you to enter the center goal.',
    initialState: {
      currentPlayer: 'Player1',
      turnQueue: [{ d1: 4, d2: null, sum: 4 }],
      players: {
        Player1: { color: 'ruby', name: 'You', hasKilled: false, pieces: [15, -1, -1, -1], team: 0 }, // Starts where the move scenario left off
        Player2: { color: 'sapphire', name: 'Opponent', hasKilled: false, pieces: [p2(19), -1, -1, -1], team: 0 }, // Perfectly positioned for the 4-step kill
        Player3: { color: 'emerald', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player4: { color: 'amber', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 }
      },
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      isTeamMode: false,
      isOnline: false,
      isQuickGame: false
    },
    expectedAction: ['MOVE_WITH_FULL_ROLL'],
    successMessage: 'Boom! You captured an opponent.'
  },
  {
    id: 'safe_zone',
    title: 'Safe Zones (X)',
    description: 'Squares marked with an X are Safe Zones. If an opponent is on a Safe Zone, you cannot capture them, and they block you from moving past them.',
    initialState: {
      currentPlayer: 'Player1',
      turnQueue: [{ d1: 4, d2: null, sum: 4 }],
      players: {
        Player1: { color: 'ruby', name: 'You', hasKilled: false, pieces: [21, -1, -1, -1], team: 0 },
        Player2: { color: 'sapphire', name: 'Opponent', hasKilled: false, pieces: [p2(25), -1, -1, -1], team: 0 }, // Square 25 is a safe zone (tip of arm)
        Player3: { color: 'emerald', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player4: { color: 'amber', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 }
      },
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      isTeamMode: false,
      isOnline: false,
      isQuickGame: false
    },
    expectedAction: null,
    successMessage: 'Notice how you cannot move your piece to the safe zone occupied by the opponent.'
  },
  {
    id: 'pair_attack',
    title: 'Pair Attack',
    description: 'To break an opponent\'s Pair Shield, you must form your own Pair Shield and land on them using a double roll.',
    initialState: {
      currentPlayer: 'Player1',
      turnQueue: [{ d1: 3, d2: 3, sum: 6 }],
      players: {
        Player1: { color: 'ruby', name: 'You', hasKilled: false, pieces: [21, 21, -1, -1], team: 0 },
        Player2: { color: 'sapphire', name: 'Opponent', hasKilled: false, pieces: [p2(24), p2(24), -1, -1], team: 0 }, // 21 + 3 = 24
        Player3: { color: 'emerald', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 },
        Player4: { color: 'amber', name: '', hasKilled: false, pieces: [-1, -1, -1, -1], team: 0 }
      },
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      isTeamMode: false,
      isOnline: false,
      isQuickGame: false
    },
    expectedAction: ['EXECUTE_PAIR_ATTACK'],
    successMessage: 'Incredible! You crushed their Pair Shield with a Pair Attack.'
  }
];
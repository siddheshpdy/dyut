import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { PLAYER_PATHS, isSafeZone } from './boardMapping';

// Function to create the initial state based on player count
const createInitialState = (gameConfig) => {
  const { playerCount, playerColors = ['yellow', 'black', 'green', 'blue'], isVoidRuleEnabled = true, bots = [], botDifficulty = 'hard', isQuickGame = false, isTeamMode = false, activeSeats = null, playerAliases = {} } = gameConfig;

  const seatsToUse = activeSeats || Array.from({ length: playerCount }).map((_, i) => `Player${i + 1}`);

  const players = {};
  seatsToUse.forEach((playerId, index) => {
    const playerNum = parseInt(playerId.replace('Player', ''));
    const team = isTeamMode ? (playerNum % 2 !== 0 ? 1 : 2) : 0; // P1 & P3 = Team 1, P2 & P4 = Team 2
    players[playerId] = {
      color: playerColors[index],
      name: playerAliases[playerId] || playerId,
      hasKilled: false,
      pieces: [-1, -1, -1, -1],
      team
    };
  });

  return {
    currentPlayer: seatsToUse[0],
    turnQueue: [],
    turnHistory: [],
    players,
    boardOccupancy: {},
    bots,
    botDifficulty,
    isVoidRuleEnabled,
    isQuickGame,
    isTeamMode,
    hasRolledThisTurn: false,
    rollingPhaseComplete: false,
  };
};

// Action Types for the Reducer
export const ACTION_TYPES = {
  ROLL_DICE: 'ROLL_DICE',
  SPAWN_PIECE: 'SPAWN_PIECE',
  END_TURN: 'END_TURN',
  CLEAR_QUEUE: 'CLEAR_QUEUE', // Used when the Void Rule (1+3) is triggered
  MOVE_WITH_FULL_ROLL: 'MOVE_WITH_FULL_ROLL',
  MOVE_AND_SPLIT_ROLL: 'MOVE_AND_SPLIT_ROLL',
  RESET_GAME: 'RESET_GAME',
  EXECUTE_PAIR_ATTACK: 'EXECUTE_PAIR_ATTACK',
};

const FINISHED_STATE = 999; // A value to signify a piece has finished

function applyCombat(playerId, pieceIndex, state, currentPlayersState, isSpawning = false) {
  const newPlayers = { ...currentPlayersState };
  const targetPos = newPlayers[playerId].pieces[pieceIndex];
  if (targetPos === -1) return newPlayers;

  const targetCellId = PLAYER_PATHS[playerId][targetPos];
  // Safe check for center or home stretch where combat is disabled
  if (!targetCellId || targetCellId.startsWith('CENTER') || targetCellId.includes('_HOME')) {
    return newPlayers;
  }

  let isTargetSafe = false;
  const parts = targetCellId.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
  if (parts) {
    const [, , col, row] = parts.map(Number);
    if (isSafeZone(col, row)) {
      isTargetSafe = true;
    }
  }

  let killed = false;

  for (const [otherPlayerId, player] of Object.entries(newPlayers)) {
    if (otherPlayerId === playerId) continue;
    
    if (state.isTeamMode && player.team === newPlayers[playerId].team) continue; // No friendly fire

    const opponentPieceIndices = player.pieces.map((p, i) => p !== -1 && PLAYER_PATHS[otherPlayerId][p] === targetCellId ? i : -1).filter(i => i !== -1);
    const opponentPiecesOnSquare = opponentPieceIndices.length;
    
    if (opponentPiecesOnSquare > 0) {
      // Safe Zone check: Only a piece spawning on 8 or 12 can kill here
      if (isTargetSafe && (!isSpawning || (targetPos !== 8 && targetPos !== 12))) {
        continue;
      }

      // Pair Shield check: Only a spawning piece can break a pair in normal combat flow
      if (opponentPiecesOnSquare === 2 && !isSpawning) {
        continue;
      }

      const newPieces = [...player.pieces];
      opponentPieceIndices.forEach(idx => newPieces[idx] = -1);
        newPlayers[otherPlayerId] = { ...player, pieces: newPieces };
        killed = true;
    }
  }

  if (killed) {
    newPlayers[playerId] = { ...newPlayers[playerId], hasKilled: true };
    
    // In Team Mode, blood debt is shared between teammates
    if (state.isTeamMode) {
      for (const pId in newPlayers) {
        if (newPlayers[pId].team === newPlayers[playerId].team) {
          newPlayers[pId] = { ...newPlayers[pId], hasKilled: true };
        }
      }
    }
  }

  return newPlayers;
}

// Central Game Reducer
function gameReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.ROLL_DICE: {
      const isDouble = action.payload.d1 === action.payload.d2 && action.payload.d2 !== null;
      // Add the new roll object to the turnQueue array
      return {
        ...state,
        turnQueue: [...state.turnQueue, action.payload],
        hasRolledThisTurn: true,
        rollingPhaseComplete: !isDouble,
      };
    }
    case ACTION_TYPES.SPAWN_PIECE:
    {
      const { playerId, pieceIndex, rollIndex } = action.payload;
      const roll = state.turnQueue[rollIndex];
      
      if (roll.d1 !== roll.d2) return state; // Only doubles can spawn
      
      const spawnPosition = roll.sum; // e.g., double 4s (8) = lands on index 8
      
      let newPlayers = { ...state.players };
      const newPieces = [...newPlayers[playerId].pieces];
      newPieces[pieceIndex] = spawnPosition;
      newPlayers[playerId] = { ...newPlayers[playerId], pieces: newPieces };

      newPlayers = applyCombat(playerId, pieceIndex, state, newPlayers, true); // isSpawning = true

      const newQueue = [...state.turnQueue];
      newQueue.splice(rollIndex, 1); // Remove the used roll

      return { ...state, players: newPlayers, turnQueue: newQueue };
    }
    case ACTION_TYPES.MOVE_WITH_FULL_ROLL:
    {
      const { playerId, pieceIndex, rollIndex, distance } = action.payload;
      let newPlayers = { ...state.players };
      const newPieces = [...newPlayers[playerId].pieces];
      const currentPos = newPieces[pieceIndex];
      const finalIndex = PLAYER_PATHS[playerId].length - 1;
      const newPosition = currentPos + distance;

      const newQueue = [...state.turnQueue];
      newQueue.splice(rollIndex, 1); // Remove the entire roll
      
      if (newPosition === finalIndex) { // It's an exact winning move
        newPieces[pieceIndex] = FINISHED_STATE;
      } else {
        newPieces[pieceIndex] = newPosition;
        newPlayers = applyCombat(playerId, pieceIndex, state, { ...newPlayers, [playerId]: { ...newPlayers[playerId], pieces: newPieces } });
      }
      
      newPlayers[playerId] = { ...newPlayers[playerId], pieces: newPieces };
      return { ...state, players: newPlayers, turnQueue: newQueue };
    }
    case ACTION_TYPES.MOVE_AND_SPLIT_ROLL:
    {
      const { playerId, pieceIndex, rollIndex, distanceUsed } = action.payload;
      const rollToSplit = state.turnQueue[rollIndex];

      // Move the piece
      let newPlayers = { ...state.players };
      const newPieces = [...newPlayers[playerId].pieces];
      const currentPos = newPieces[pieceIndex];
      const finalIndex = PLAYER_PATHS[playerId].length - 1;
      const newPosition = currentPos + distanceUsed;
      const distanceRemaining = rollToSplit.sum - distanceUsed;

      // Replace the old roll with the new partial one
      const newQueue = [...state.turnQueue];

      if (newPosition === finalIndex) { // It's an exact winning move
        newPieces[pieceIndex] = FINISHED_STATE;
        newQueue[rollIndex] = { d1: distanceRemaining, d2: null, sum: distanceRemaining };
      } else {
        newPieces[pieceIndex] = newPosition;
        newPlayers = applyCombat(playerId, pieceIndex, state, { ...newPlayers, [playerId]: { ...newPlayers[playerId], pieces: newPieces } });
        newQueue[rollIndex] = { d1: distanceRemaining, d2: null, sum: distanceRemaining };
      }

      newPlayers[playerId] = { ...newPlayers[playerId], pieces: newPieces };
      return { ...state, players: newPlayers, turnQueue: newQueue };
    }

    case ACTION_TYPES.EXECUTE_PAIR_ATTACK: {
      const { playerId, rollIndex, firstPieceIndex, secondPieceIndex, targetCellId } = action.payload;
      const roll = state.turnQueue[rollIndex];
      const moveDistance = roll.d1; // In a double, d1 is the move distance for each piece

      let newPlayers = { ...state.players };
      const attackerPieces = [...newPlayers[playerId].pieces];

      // Find the defending player and their pieces on the target square
      let defendingPlayerId = null;
      const defendingPieceIndices = [];
      for (const [pId, pData] of Object.entries(newPlayers)) {
        if (pId === playerId) continue;
        pData.pieces.forEach((pos, i) => {
          if (pos !== -1 && PLAYER_PATHS[pId][pos] === targetCellId) {
            defendingPlayerId = pId;
            defendingPieceIndices.push(i);
          }
        });
      }

      // Update attacker's pieces
      attackerPieces[firstPieceIndex] += moveDistance;
      attackerPieces[secondPieceIndex] += moveDistance;
      newPlayers[playerId] = { ...newPlayers[playerId], pieces: attackerPieces, hasKilled: true };
      
      // Share blood debt for pair attacks in Team Mode
      if (state.isTeamMode) {
        for (const pId in newPlayers) {
          if (newPlayers[pId].team === newPlayers[playerId].team) {
            newPlayers[pId] = { ...newPlayers[pId], hasKilled: true };
          }
        }
      }

      // Update defender's pieces (send them back to base)
      if (defendingPlayerId && defendingPieceIndices.length === 2) {
        const defenderPieces = [...newPlayers[defendingPlayerId].pieces];
        defenderPieces[defendingPieceIndices[0]] = -1;
        defenderPieces[defendingPieceIndices[1]] = -1;
        newPlayers[defendingPlayerId] = { ...newPlayers[defendingPlayerId], pieces: defenderPieces };
      }

      const newQueue = state.turnQueue.filter((_, i) => i !== rollIndex);
      return { ...state, players: newPlayers, turnQueue: newQueue };
    }

    case ACTION_TYPES.END_TURN: {
      const playerKeys = Object.keys(state.players);
      const currentIndex = playerKeys.indexOf(state.currentPlayer);
      const nextPlayer = playerKeys[(currentIndex + 1) % playerKeys.length];
      return { ...state, currentPlayer: nextPlayer, turnQueue: [], hasRolledThisTurn: false, rollingPhaseComplete: false };
    }

    case ACTION_TYPES.CLEAR_QUEUE:
      return { ...state, turnQueue: [], hasRolledThisTurn: true, rollingPhaseComplete: true };

    default:
      return state;
  }
}

// Context Setup
const GameContext = createContext();

const LOCAL_STORAGE_KEY = 'dyut_game_state';

const initGameState = (initialState) => {
  try {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      // Validate that the saved state has the same number of players
      if (Object.keys(parsedState.players).length === Object.keys(initialState.players).length) {
        // Provide fallback for older saves to prevent crashes
        return { rollingPhaseComplete: false, ...parsedState };
      }
    }
  } catch (error) {
    console.error("Failed to load game state from local storage:", error);
  }
  return initialState;
};

export function GameProvider({ gameConfig, children }) {
  const getInitialState = () => createInitialState(gameConfig);

  const enhancedReducer = (state, action) => {
    if (action.type === ACTION_TYPES.RESET_GAME) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return getInitialState();
    }
    return gameReducer(state, action);
  };

  const [state, dispatch] = useReducer(enhancedReducer, gameConfig, (config) => initGameState(createInitialState(config)));

  useEffect(() => {
    // Only save state if the game is active (not on initial setup)
    if (state.players) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

// Custom hook for consuming the game state
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
import React, { useMemo, useState, useEffect } from 'react';
import { generateBoardCells, PLAYER_PATHS } from './boardMapping';
import { useGame, ACTION_TYPES } from './GameContext';
import MoveSelector from './MoveSelector';
import VictoryScreen from './VictoryScreen';
import { getValidMoves, getPairShieldTarget } from './gameLogic';
import { usePrevious } from './usePrevious';
import { playSound } from './audio';

// The individual Square component
const Square = ({ cell, occupants, children, isCapturing }) => {
  const isCenter = cell.id === 'CENTER';
  
  // Apply the calculated grid row and column to perfectly position the square
  const style = {
    gridColumn: cell.gridCol || cell.gridColumn, 
    gridRow: cell.gridRow
  };

  return (
    <div
      style={style}
      className={`
        relative flex items-center justify-center transition-colors
        border border-white/30 shadow-inner
        ${cell.isSafe ? 'bg-dyut-safe' : 'bg-dyut-board'}
        ${isCapturing ? 'animate-capture-flash' : ''}
      `}
    >
      {/* Draw an 'X' if it's a safe zone, skipping the center goal */}
      {cell.isSafe && !isCenter && (
        <svg className="absolute w-3/4 h-3/4 text-white/40 pointer-events-none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      
      {/* Center Goal UI */}
      {isCenter && (
        <div className="text-white text-center flex flex-col items-center justify-center pointer-events-none w-full h-full">
          <span className="font-bold text-xs sm:text-xl md:text-3xl tracking-widest drop-shadow-md">DYUT</span>
          <span className="text-[8px] sm:text-[10px] md:text-xs uppercase tracking-widest opacity-75 hidden sm:block md:mt-1">Goal</span>
        </div>
      )}

      {/* Render Occupying Pieces */}
      {occupants && occupants.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {occupants.map((occ, i) => (
            <div key={i} className={`absolute w-[80%] h-[80%] flex items-center justify-center transition-all ${occ.isMovable ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${i > 0 ? 'ml-2 mt-2 z-20' : 'z-10'}`} style={{ pointerEvents: 'auto' }} onClick={occ.onClick}>
              <Piece color={occ.color} isMovable={occ.isMovable} isHomeStretch={occ.isHomeStretch} />
            </div>
          ))}
        </div>
      )}

      {/* For rendering the MoveSelector popup */}
      {children}
    </div>
  );
};

// Visual Piece Token
const Piece = ({ color, isMovable, isHomeStretch }) => {
  // Map the state color to our Tailwind classes
  const bgClass = {
    yellow: 'bg-piece-yellow',
    black: 'bg-piece-black',
    green: 'bg-piece-green',
    blue: 'bg-piece-blue',
    red: 'bg-red-400',
    purple: 'bg-purple-400',
    ruby: 'bg-ruby',
    sapphire: 'bg-sapphire',
    emerald: 'bg-emerald',
    amber: 'bg-amber',
  }[color];

  let ringClass = '';
  if (isMovable) {
    ringClass = 'animate-pulse ring-4 ring-yellow-300 ring-offset-2 ring-offset-black/50';
  } else if (isHomeStretch) {
    ringClass = 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-black/50';
  }

  return (
    <div className={`w-[80%] aspect-square rounded-full border border-white/40 jewel-shadow ${bgClass} ${ringClass} animate-hop`} />
  );
};

// The Player's Yard/Base for locked pieces
const PlayerBase = ({ playerId, player, gridRow, gridCol, pairAttackState }) => {
  const { state, dispatch } = useGame();
  // Find indices of locked pieces
  const lockedIndices = player.pieces.map((pos, i) => pos === -1 ? i : -1).filter(i => i !== -1);
  const canSpawn = state.currentPlayer === playerId && state.turnQueue.some(r => r.d1 === r.d2) && !pairAttackState;
  const finishedCount = player.pieces.filter(p => p === 999).length;

  const handleSpawnClick = (pieceIndex) => {
    // Only current player can spawn, and only if they have a double in the queue
    if (state.currentPlayer !== playerId) return;
    const doubleIndex = state.turnQueue.findIndex(r => r.d1 === r.d2);
    if (doubleIndex !== -1) {
      dispatch({
        type: ACTION_TYPES.SPAWN_PIECE,
        payload: { playerId, pieceIndex, rollIndex: doubleIndex }
      });
    }
  };

  return (
    <div
      style={{ gridRow, gridColumn: gridCol }}
      className="flex flex-col items-center justify-center p-2 sm:p-4"
    >
      <div className="mb-2 text-white font-bold text-xs sm:text-sm drop-shadow-md flex flex-col items-center text-center">
        <span>{playerId}</span>
        {player.hasKilled ? (
          <span className="text-red-400 text-[8px] sm:text-[10px] uppercase tracking-wider">Blood Debt Paid</span>
        ) : (
          <span className="text-white/50 text-[8px] sm:text-[10px] uppercase tracking-wider">No Kills</span>
        )}
      </div>
      {/* Base Container - A 2x2 grid for the locked pieces */}
      <div className="w-full h-full max-w-[120px] max-h-[120px] aspect-square grid grid-cols-2 grid-rows-2 gap-1 sm:gap-2 p-2 bg-black/15 rounded-xl shadow-inner border border-white/10">
        {lockedIndices.map((pieceIndex) => (
          <div key={pieceIndex} className={`flex items-center justify-center transition-transform ${canSpawn ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`} onClick={() => handleSpawnClick(pieceIndex)}>
            <Piece color={player.color} isMovable={canSpawn} />
          </div>
        ))}
      </div>
      {finishedCount > 0 && (
        <div className="mt-1 text-xs text-yellow-300 font-semibold">
          {finishedCount} / 4 Finished
        </div>
      )}
    </div>
  );
};

// The main Board container
const Board = ({ onGoToMenu }) => {
  const { state, dispatch } = useGame();
  const prevState = usePrevious(state);
  const [selectedPiece, setSelectedPiece] = useState(null); // e.g., { playerId, pieceIndex, rollIndex }
  const [pairAttackState, setPairAttackState] = useState(null); // { firstPieceIndex, roll, rollIndex, targetCellId }
  const [captureAnimationCellId, setCaptureAnimationCellId] = useState(null);
  // Generate the 97 cells (96 path squares + 1 center) exactly once
  const cells = useMemo(() => generateBoardCells(), []);

  // Map the 4 players to the 4 empty corners of the 19x19 grid
  const allBases = [
    { id: 'Player1', row: '14 / span 6', col: '2 / span 6' },  // South-West (Yellow)
    { id: 'Player2', row: '14 / span 6', col: '14 / span 6' }, // South-East (Black)
    { id: 'Player3', row: '2 / span 6', col: '14 / span 6' },  // North-East (Green)
    { id: 'Player4', row: '2 / span 6', col: '2 / span 6' },   // North-West (Blue)
  ];

  const activeBases = allBases.filter(base => state.players[base.id]);

  const winnerInfo = useMemo(() => {
    const winnerEntry = Object.entries(state.players).find(([id, player]) => player.pieces.every(p => p === 999));
    return winnerEntry ? { id: winnerEntry[0], data: winnerEntry[1] } : null;
  }, [state.players]);

  useEffect(() => {
    if (!prevState || !state) return;

    for (const playerId in state.players) {
        const prevPlayer = prevState.players[playerId];
        const currentPlayer = state.players[playerId];

        if (prevPlayer && currentPlayer) {
            // Check for captures
            const prevLockedCount = prevPlayer.pieces.filter(p => p === -1).length;
            const currentLockedCount = currentPlayer.pieces.filter(p => p === -1).length;
            if (currentLockedCount > prevLockedCount) {
                playSound('./sounds/capture.mp3');
                // Find which piece was captured to trigger the animation
                const capturedPieceIndex = prevPlayer.pieces.findIndex((prevPos, i) => prevPos !== -1 && currentPlayer.pieces[i] === -1);
                if (capturedPieceIndex !== -1) {
                    const capturedPiecePos = prevPlayer.pieces[capturedPieceIndex];
                    const capturedCellId = PLAYER_PATHS[playerId][capturedPiecePos]?.replace('_HOME', '');
                    if (capturedCellId) {
                        setCaptureAnimationCellId(capturedCellId);
                        setTimeout(() => setCaptureAnimationCellId(null), 800); // Duration matches animation
                    }
                }
            }

            // Check for goals
            const prevFinishedCount = prevPlayer.pieces.filter(p => p === 999).length;
            const currentFinishedCount = currentPlayer.pieces.filter(p => p === 999).length;
            if (currentFinishedCount > prevFinishedCount) {
                playSound('./sounds/goal.mp3');
            }
        }
    }
  }, [state.players, prevState]);


  const handlePieceClick = (playerId, pieceIndex) => {
    // If we are in the second step of a pair attack, this click is the selection of the second piece.
    if (pairAttackState) {
      const { firstPieceIndex, roll, rollIndex, targetCellId } = pairAttackState;
      const moveDistance = roll.d1;
      const currentPos = state.players[playerId].pieces[pieceIndex];
      const targetPathIndex = PLAYER_PATHS[playerId].indexOf(targetCellId);

      // Check if this piece is a valid partner for the attack
      if (pieceIndex !== firstPieceIndex && (currentPos + moveDistance === targetPathIndex)) {
        dispatch({
          type: ACTION_TYPES.EXECUTE_PAIR_ATTACK,
          payload: { playerId, rollIndex, firstPieceIndex, secondPieceIndex: pieceIndex, targetCellId }
        });
        setPairAttackState(null); // Reset attack state
      }
      return;
    }

    // Can only select pieces if it's your turn and you have rolls in the queue
    if (state.currentPlayer !== playerId || state.turnQueue.length === 0) {
      setSelectedPiece(null);
      return;
    }
    setSelectedPiece({ playerId, pieceIndex, rollIndex: 0 }); // Select the piece and target the first roll
  };

  const handleInitiatePairAttack = (targetCellId) => {
    if (!selectedPiece) return;
    setPairAttackState({
      firstPieceIndex: selectedPiece.pieceIndex,
      roll: activeRoll,
      rollIndex: selectedPiece.rollIndex,
      targetCellId,
    });
    setSelectedPiece(null); // Close the move selector
  };

  const handleFullMove = (distance) => {
    if (!selectedPiece) return;
    dispatch({
      type: ACTION_TYPES.MOVE_WITH_FULL_ROLL,
      payload: { ...selectedPiece, distance }
    });
    setSelectedPiece(null); // Close the selector after moving
  };

  const handleSplitMove = (distanceUsed) => {
    if (!selectedPiece) return;
    dispatch({
      type: ACTION_TYPES.MOVE_AND_SPLIT_ROLL,
      payload: { ...selectedPiece, distanceUsed }
    });
    setSelectedPiece(null); // Close the selector after moving
  };

  const activeRoll = selectedPiece ? state.turnQueue[selectedPiece.rollIndex] : null;

  const validMoves = useMemo(() => {
    if (!selectedPiece || !activeRoll) return null;
    const pieceCurrentPos = state.players[selectedPiece.playerId].pieces[selectedPiece.pieceIndex];
    return getValidMoves(pieceCurrentPos, activeRoll, selectedPiece.playerId, state);
  }, [selectedPiece, activeRoll, state]);

  const possiblePairAttacks = useMemo(() => {
    if (!selectedPiece || !activeRoll || !(activeRoll.d1 === activeRoll.d2 && activeRoll.d2 !== null)) {
      return [];
    }
    const { playerId, pieceIndex } = selectedPiece;
    const pieceCurrentPos = state.players[playerId].pieces[pieceIndex];
    const moveDistance = activeRoll.d1;
    const targetPos = pieceCurrentPos + moveDistance;

    if (getPairShieldTarget(targetPos, playerId, state.players)) {
      // Now check if there's another piece that can make the same move
      const hasPartner = state.players[playerId].pieces.some((pos, i) => {
        return i !== pieceIndex && pos !== -1 && (pos + moveDistance === targetPos);
      });
      if (hasPartner) {
        const targetCellId = PLAYER_PATHS[playerId][targetPos];
        return [{ targetCellId, roll: activeRoll }];
      }
    }
    return [];
  }, [selectedPiece, activeRoll, state.players]);

  // Find which pieces are on which cells
  const getOccupants = (cellId) => {
    const occupants = [];
    Object.entries(state.players).forEach(([playerId, player]) => {
      const isCurrentPlayer = state.currentPlayer === playerId;
      const hasRolls = state.turnQueue.length > 0;
      player.pieces.forEach((pos, pieceIndex) => {
        const logicalId = PLAYER_PATHS[playerId][pos];
        const visualId = logicalId ? logicalId.replace('_HOME', '') : null;

        if (pos !== -1 && pos < 999 && visualId === cellId) {
          let isMovable = isCurrentPlayer && hasRolls && !pairAttackState;
          // If in a pair attack, only highlight valid partners
          if (pairAttackState && isCurrentPlayer && pieceIndex !== pairAttackState.firstPieceIndex) {
            const moveDistance = pairAttackState.roll.d1;
            const targetPathIndex = PLAYER_PATHS[playerId].indexOf(pairAttackState.targetCellId);
            if (pos !== -1 && (pos + moveDistance === targetPathIndex)) {
              isMovable = true;
            } else {
              isMovable = false;
            }
          }

          occupants.push({
            playerId,
            color: player.color,
            pieceIndex,
            isMovable,
            isHomeStretch: logicalId.includes('_HOME'),
            onClick: () => {
              handlePieceClick(playerId, pieceIndex);
            }
          });
        }
      });
    });
    return occupants;
  };

  return (
    <div className="w-[98vmin] max-w-3xl aspect-square mx-auto p-1 sm:p-4">
      <div 
        className="w-full h-full grid drop-shadow-2xl bg-amber-50/5 rounded-sm p-1"
        style={{ 
          gridTemplateColumns: 'repeat(19, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(19, minmax(0, 1fr))'
        }}
      >
        {winnerInfo && <VictoryScreen winnerId={winnerInfo.id} onNewGame={onGoToMenu} />}

        {pairAttackState && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg text-center z-30 animate-pulse">
            Select a second piece to attack the pair!
          </div>
        )}

        {cells.map(cell => (
          <Square key={cell.id} cell={cell} occupants={getOccupants(cell.id)} isCapturing={captureAnimationCellId === cell.id}>
            {/* Render the MoveSelector inside the square of the selected piece */}
            {selectedPiece && activeRoll && PLAYER_PATHS[selectedPiece.playerId][state.players[selectedPiece.playerId].pieces[selectedPiece.pieceIndex]]?.replace('_HOME', '') === cell.id && (
              <MoveSelector
                roll={activeRoll}
                validMoves={validMoves}
                possiblePairAttacks={possiblePairAttacks}
                onFullMove={handleFullMove}
                onSplitMove={handleSplitMove}
                onInitiatePairAttack={handleInitiatePairAttack}
                onClose={() => setSelectedPiece(null)}
              />
            )}
          </Square>
        ))}
        
        {/* Render the 4 player bases */}
        {activeBases.map(base => (
          <PlayerBase 
            key={base.id}
            playerId={base.id}
            player={state.players[base.id]}
            gridRow={base.row}
            gridCol={base.col}
            pairAttackState={pairAttackState}
          />
        ))}
      </div>
    </div>
  );
};

export default Board;
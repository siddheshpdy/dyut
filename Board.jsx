import React, { useMemo, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { generateBoardCells, PLAYER_PATHS, isSafeZone } from './boardMapping';
import { useGame, ACTION_TYPES } from './GameContext';
import MoveSelector from './MoveSelector';
import VictoryScreen from './VictoryScreen';
import { getValidMoves, getPairShieldTarget, canSpawnPiece, getProxyPlayerId } from './gameLogic';
import { usePrevious } from './usePrevious';
import { playSound } from './audio';

// The individual Square component
const Square = ({ cell, occupants, isCapturing, finishedPieces }) => {
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
        relative flex items-center justify-center transition-colors border border-black/40 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]
        ${cell.isSafe ? 'bg-dyut-safe' : 'bg-dyut-board'}
      `}
    >
      {/* Geometric Glowing Safe Zone Symbol */}
      {cell.isSafe && !isCenter && (
        <svg className="absolute w-3/5 h-3/5 text-gold/60 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)] pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1.5L14.5 9.5L22.5 12L14.5 14.5L12 22.5L9.5 14.5L1.5 12L9.5 9.5L12 1.5Z" />
        </svg>
      )}
      
      {/* Center Goal UI */}
      {isCenter && (
        <div className="text-gold text-center flex items-center justify-center pointer-events-none w-full h-full p-0.5 sm:p-2">
          {finishedPieces && finishedPieces.length > 0 ? (
            <div className="grid grid-cols-2 place-items-center gap-0.5 sm:gap-1 md:gap-2">
              {finishedPieces.map((fp) => (
                <div key={fp.playerId} className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-3.5 h-3.5 sm:w-6 sm:h-6 md:w-8 md:h-8">
                    <Piece color={fp.color} />
                  </div>
                  <span className="text-[5px] sm:text-[8px] md:text-[10px] text-white font-bold leading-none mt-px sm:mt-0.5">{fp.count}/4</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[6px] sm:text-[10px] md:text-xs uppercase tracking-widest opacity-80 font-sans">Goal</span>
          )}
        </div>
      )}

      {/* Capture Animation */}
      {isCapturing && (
        <div className="absolute inset-0 w-[90%] h-[90%] m-auto rounded-full border-4 border-white/90 shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-shockwave pointer-events-none"></div>
      )}

      {/* Render Occupying Pieces */}
      {occupants && occupants.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {occupants.map((occ, i) => {
            let offsetClass = '';
            if (occupants.length === 2) {
              offsetClass = i === 0 ? '-translate-x-[15%]' : 'translate-x-[15%] z-20';
            } else if (occupants.length === 3) {
              offsetClass = i === 0 ? '-translate-x-[15%] -translate-y-[15%]' : i === 1 ? 'translate-x-[15%] -translate-y-[15%] z-20' : 'translate-y-[15%] z-30';
            } else if (occupants.length >= 4) {
              offsetClass = i === 0 ? '-translate-x-[15%] -translate-y-[15%]' : i === 1 ? 'translate-x-[15%] -translate-y-[15%] z-20' : i === 2 ? '-translate-x-[15%] translate-y-[15%] z-30' : 'translate-x-[15%] translate-y-[15%] z-40';
            }
            return (
              <div key={i} className={`absolute w-[80%] h-[80%] flex items-center justify-center transition-all ${occ.isMovable ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${offsetClass}`} style={{ pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); occ.onClick(); }}>
                <Piece color={occ.color} isMovable={occ.isMovable} isHomeStretch={occ.isHomeStretch} playerId={occ.playerId} pieceIndex={occ.pieceIndex} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Visual Piece Token
const Piece = ({ color, isMovable, isHomeStretch, playerId, pieceIndex }) => {
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
  if (isMovable && isHomeStretch) {
    ringClass = 'animate-pulse ring-[3px] ring-cyan-300 ring-offset-2 ring-offset-black/50 shadow-[0_0_10px_rgba(34,211,238,0.6)]';
  } else if (isMovable) {
    ringClass = 'animate-pulse ring-[3px] ring-white/90 ring-offset-2 ring-offset-black/50';
  } else if (isHomeStretch) {
    ringClass = 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-black/50';
  }

  // Assign a unique view-transition-name to each piece so the browser can animate its movement
  const transitionName = playerId != null && pieceIndex != null ? `piece-${playerId}-${pieceIndex}` : undefined;

  const shapeClass = isHomeStretch
    ? 'w-[75%] h-[85%] rounded-t-full rounded-b-[10px] shadow-[inset_-2px_-4px_8px_rgba(0,0,0,0.5),0_5px_8px_rgba(0,0,0,0.6)]'
    : 'w-[80%] aspect-square rounded-full shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.4)]';

  const innerShapeClass = isHomeStretch
    ? 'w-[35%] aspect-square bg-white/90 shadow-[inset_0_-2px_3px_rgba(0,0,0,0.4)] -translate-y-[15%]'
    : 'w-[35%] h-[35%] bg-white/80 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3)]';

  return (
    <div style={transitionName ? { viewTransitionName: transitionName } : {}} 
         className={`flex items-center justify-center border-[1.5px] border-white/60 ${shapeClass} ${bgClass} ${ringClass}`}>
      <div className={`rounded-full pointer-events-none ${innerShapeClass}`}></div>
    </div>
  );
};

// The Player's Yard/Base for locked pieces
const PlayerBase = ({ playerId, player, gridRow, gridCol, pairAttackState, onSpawnClick }) => {
  const { state } = useGame();
  
  const isRollingPhaseActive = state.hasRolledThisTurn && !state.rollingPhaseComplete;
  const isActive = state.currentPlayer === playerId;

  // Find indices of locked pieces
  const lockedIndices = player.pieces.map((pos, i) => pos === -1 ? i : -1).filter(i => i !== -1);
  
  const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
  const hasValidSpawn = state.turnQueue.some(r => r.d1 === r.d2 && canSpawnPiece(playerId, r.sum, state));
  const canSpawn = activePlayerId === playerId && hasValidSpawn && !pairAttackState && !isRollingPhaseActive;

  const baseColorClass = {
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
  }[player.color];

  return (
    <div
      style={{ gridRow, gridColumn: gridCol }}
      className="flex flex-col items-center justify-center p-0 sm:p-2 lg:p-4 relative"
    >
      <div className="mb-1 sm:mb-2 flex flex-col items-center">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Avatar/Color Indicator */}
          <div className={`w-2 h-2 sm:w-4 sm:h-4 rounded-full jewel-shadow border border-white/40 ${baseColorClass}`}></div>
          <span className={`font-display tracking-wider sm:tracking-widest text-[10px] sm:text-xs md:text-sm font-bold truncate max-w-[45px] sm:max-w-none transition-all duration-300 ${isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-gold'}`}>{player.name || playerId}</span>
          {state.isTeamMode && (
            <span className={`ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[6px] sm:text-[8px] font-sans font-bold uppercase tracking-widest rounded border ${player.team === 1 ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30' : 'bg-rose-500/20 text-rose-200 border-rose-500/30'}`} title={`Team ${player.team}`}>
              T{player.team}
            </span>
          )}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-0.5 sm:mt-2" title={player.hasKilled ? "Blood Debt Paid" : "No Kills"}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 sm:w-5 sm:h-5 transition-all duration-500 ${player.hasKilled ? 'text-ruby drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] scale-110' : 'text-white/20'}`}>
            <path d="M14.5 17.5L3 6V3h3l11.5 11.5"></path>
            <path d="M13 19l6-6"></path>
            <path d="M16 16l4 4"></path>
            <path d="M19 21l2-2"></path>
            <path d="M9.5 17.5L21 6V3h-3L6.5 11.5"></path>
            <path d="M11 19l-6-6"></path>
            <path d="M8 16l-4 4"></path>
            <path d="M5 21l-2-2"></path>
          </svg>
        </div>
      </div>
      {/* Base Container - A 2x2 grid for the locked pieces */}
      <div className={`w-[70%] sm:w-[80%] lg:w-full max-w-[80px] sm:max-w-[100px] lg:max-w-[120px] aspect-square grid grid-cols-2 grid-rows-2 gap-1 sm:gap-2 p-1 sm:p-2 lg:p-3 rounded-xl transition-all duration-500 ${isActive ? 'bg-black/60 shadow-[0_0_20px_rgba(251,191,36,0.3),inset_0_4px_12px_rgba(0,0,0,0.6)] border border-gold/70 scale-105' : 'bg-black/40 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)] border border-white/5'}`}>
        {lockedIndices.map((pieceIndex) => (
          <div key={pieceIndex} className={`flex items-center justify-center transition-transform ${canSpawn ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`} onClick={() => { if (canSpawn) onSpawnClick(playerId, pieceIndex); }}>
            <Piece color={player.color} isMovable={canSpawn} playerId={playerId} pieceIndex={pieceIndex} />
          </div>
        ))}
      </div>
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
  
  const isRollingPhaseActive = state.hasRolledThisTurn && !state.rollingPhaseComplete;

  // Map the 4 players to the 4 empty corners of the 19x19 grid
  const allBases = [
    { id: 'Player1', row: '14 / span 6', col: '2 / span 6' },  // South-West (Yellow)
    { id: 'Player2', row: '14 / span 6', col: '14 / span 6' }, // South-East (Black)
    { id: 'Player3', row: '2 / span 6', col: '14 / span 6' },  // North-East (Green)
    { id: 'Player4', row: '2 / span 6', col: '2 / span 6' },   // North-West (Blue)
  ];

  const activeBases = allBases.filter(base => state.players[base.id]);

  const winnerInfo = useMemo(() => {
    if (state.isQuickGame) {
      const winnerEntry = Object.entries(state.players).find(([id, player]) => player.pieces.some(p => p === 999));
      if (winnerEntry) {
        if (state.isTeamMode) {
          const winningTeam = winnerEntry[1].team;
          const teamPlayers = Object.entries(state.players).filter(([id, p]) => p.team === winningTeam).map(e => e[1].name || e[0]);
          return { id: `Team ${winningTeam} (${teamPlayers.join(' & ')})`, data: {} };
        }
        return { id: winnerEntry[1].name || winnerEntry[0], data: winnerEntry[1] };
      }
      return null;
    }

    if (state.isTeamMode) {
      const teams = {};
      for (const [id, player] of Object.entries(state.players)) {
        if (!teams[player.team]) teams[player.team] = { allFinished: true, players: [] };
        teams[player.team].players.push(id);
        if (!player.pieces.every(p => p === 999)) teams[player.team].allFinished = false;
      }
      const winningTeam = Object.entries(teams).find(([team, data]) => data.allFinished);
      if (winningTeam) {
        const teamNames = winningTeam[1].players.map(id => state.players[id].name || id);
        return { id: `Team ${winningTeam[0]} (${teamNames.join(' & ')})`, data: {} };
      }
      return null;
    }

    const winnerEntry = Object.entries(state.players).find(([id, player]) => player.pieces.every(p => p === 999));
    return winnerEntry ? { id: winnerEntry[1].name || winnerEntry[0], data: winnerEntry[1] } : null;
  }, [state.players, state.isQuickGame, state.isTeamMode]);

  const finishedPieces = useMemo(() => {
    const counts = [];
    Object.entries(state.players).forEach(([playerId, player]) => {
      const count = player.pieces.filter(p => p === 999).length;
      if (count > 0) {
        counts.push({ playerId, count, color: player.color });
      }
    });
    return counts;
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
                playSound(`${import.meta.env.BASE_URL}sounds/capture.mp3`);
                // Find which piece was captured to trigger the animation
                const capturedPieceIndex = prevPlayer.pieces.findIndex((prevPos, i) => prevPos !== -1 && currentPlayer.pieces[i] === -1);
                if (capturedPieceIndex !== -1) {
                    const capturedPiecePos = prevPlayer.pieces[capturedPieceIndex];
                    const capturedCellId = PLAYER_PATHS[playerId][capturedPiecePos]?.replace('_HOME', '');
                    if (capturedCellId) {
                        setCaptureAnimationCellId(capturedCellId);
                        setTimeout(() => setCaptureAnimationCellId(null), 600); // Duration matches new animation
                    }
                }
            }

            // Check for goals
            const prevFinishedCount = prevPlayer.pieces.filter(p => p === 999).length;
            const currentFinishedCount = currentPlayer.pieces.filter(p => p === 999).length;
            if (currentFinishedCount > prevFinishedCount) {
                playSound(`${import.meta.env.BASE_URL}sounds/goal.mp3`);
            }
        }
    }
  }, [state.players, prevState]);

  // Clear selected piece and attack state when the turn changes to prevent stale UI
  useEffect(() => {
    setSelectedPiece(null);
    setPairAttackState(null);
  }, [state.currentPlayer]);

  const dispatchWithTransition = (action) => {
    if (!document.startViewTransition) {
      dispatch(action);
      return;
    }
    document.startViewTransition(() => {
      flushSync(() => {
        dispatch(action);
      });
    });
  };

  const handlePieceClick = (playerId, pieceIndex) => {
    // If we are in the second step of a pair attack, this click is the selection of the second piece.
    if (pairAttackState) {
      const { firstPieceIndex, roll, rollIndex, targetCellId } = pairAttackState;
      const moveDistance = roll.d1;
      const currentPos = state.players[playerId].pieces[pieceIndex];
      const targetPathIndex = PLAYER_PATHS[playerId].indexOf(targetCellId);

      // Check if this piece is a valid partner for the attack
      if (pieceIndex !== firstPieceIndex && (currentPos + moveDistance === targetPathIndex)) {
        dispatchWithTransition({
          type: ACTION_TYPES.EXECUTE_PAIR_ATTACK,
          payload: { playerId, rollIndex, firstPieceIndex, secondPieceIndex: pieceIndex, targetCellId }
        });
        setPairAttackState(null); // Reset attack state
      }
      return;
    }

    // Can only select pieces if it's your turn and you have rolls in the queue
    const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
    const isMyTurn = !state.isOnline || state.playerUids[activePlayerId] === state.localUid || (state.bots?.includes(activePlayerId) && state.localUid === state.hostUid);

    if (!isMyTurn || activePlayerId !== playerId || state.turnQueue.length === 0 || isRollingPhaseActive) {
      setSelectedPiece(null);
      return;
    }
    setSelectedPiece({ playerId, pieceIndex, rollIndex: 0 }); // Select the piece and target the first roll
  };

  const handleNextRoll = () => {
    setSelectedPiece(prev => {
      if (!prev) return null;
      return { ...prev, rollIndex: (prev.rollIndex + 1) % state.turnQueue.length };
    });
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

  let isHomeStretchSelected = false;
  if (selectedPiece && !selectedPiece.isLocked) {
    const logicalId = PLAYER_PATHS[selectedPiece.playerId][state.players[selectedPiece.playerId].pieces[selectedPiece.pieceIndex]];
    isHomeStretchSelected = logicalId && logicalId.includes('_HOME');
  }

  const handleSpawnClick = (playerId, pieceIndex) => {
    const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
    if (activePlayerId !== playerId || isRollingPhaseActive) return;
    
    const validDoubleIndex = state.turnQueue.findIndex(r => r.d1 === r.d2 && canSpawnPiece(playerId, r.sum, state));
    if (validDoubleIndex !== -1) {
      setSelectedPiece({ playerId, pieceIndex, rollIndex: validDoubleIndex, isLocked: true });
    }
  };

  const handleFullMove = (distance) => {
    if (!selectedPiece) return;
    if (selectedPiece.isLocked) {
      dispatchWithTransition({
        type: ACTION_TYPES.SPAWN_PIECE,
        payload: { playerId: selectedPiece.playerId, pieceIndex: selectedPiece.pieceIndex, rollIndex: selectedPiece.rollIndex }
      });
    } else {
      dispatchWithTransition({
        type: ACTION_TYPES.MOVE_WITH_FULL_ROLL,
        payload: { ...selectedPiece, distance }
      });
    }
    setSelectedPiece(null); 
  };

  const handleSplitMove = (distanceUsed) => {
    if (!selectedPiece || selectedPiece.isLocked) return;
    dispatchWithTransition({
      type: ACTION_TYPES.MOVE_AND_SPLIT_ROLL,
      payload: { ...selectedPiece, distanceUsed }
    });
    setSelectedPiece(null); // Close the selector after moving
  };

  const activeRoll = selectedPiece ? state.turnQueue[selectedPiece.rollIndex] : null;

  const validMoves = useMemo(() => {
    if (!selectedPiece || !activeRoll) return null;
    if (selectedPiece.isLocked) {
      const canSpawn = activeRoll.d1 === activeRoll.d2 && canSpawnPiece(selectedPiece.playerId, activeRoll.sum, state);
      return { sum: canSpawn, high: false, low: false };
    }
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

    if (getPairShieldTarget(targetPos, playerId, state)) {
      const targetCellId = PLAYER_PATHS[playerId][targetPos];
      const parts = targetCellId?.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
      let isTargetSafe = false;
      if (parts) {
        const [, , col, row] = parts.map(Number);
        isTargetSafe = isSafeZone(col, row);
      }
      
      // A Pair Shield safely resting on an 'X' zone cannot be targeted by a split-pair attack
      if (!isTargetSafe) {
        // Now check if there's another piece that can make the same move
        const hasPartner = state.players[playerId].pieces.some((pos, i) => {
          return i !== pieceIndex && pos !== -1 && (pos + moveDistance === targetPos);
        });
        if (hasPartner) {
          return [{ targetCellId, roll: activeRoll }];
        }
      }
    }
    return [];
  }, [selectedPiece, activeRoll, state.players]);

  // Find which pieces are on which cells
  const getOccupants = (cellId) => {
    const occupants = [];
    const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
    const isMyTurn = !state.isOnline || state.playerUids[activePlayerId] === state.localUid || (state.bots?.includes(activePlayerId) && state.localUid === state.hostUid);

    Object.entries(state.players).forEach(([playerId, player]) => {
      const isCurrentPlayer = state.currentPlayer === playerId;
      const isActiveOrProxy = playerId === activePlayerId;
      const hasRolls = state.turnQueue.length > 0;
      player.pieces.forEach((pos, pieceIndex) => {
        const logicalId = PLAYER_PATHS[playerId][pos];
        const visualId = logicalId ? logicalId.replace('_HOME', '') : null;

        if (pos !== -1 && pos < 999 && visualId === cellId) {
          let isMovable = isMyTurn && isActiveOrProxy && hasRolls && !pairAttackState && !isRollingPhaseActive;
          // If in a pair attack, only highlight valid partners
          if (pairAttackState && isActiveOrProxy && pieceIndex !== pairAttackState.firstPieceIndex) {
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
    <div className="w-full max-w-[98vw] lg:max-w-none lg:w-auto lg:h-[80vh] aspect-square mx-auto sm:p-2">
      <div 
        className="w-full h-full grid shadow-[0_20px_50px_rgba(0,0,0,0.7)] bg-[#373737] border-[3px] sm:border-8 border-[#1a0101] rounded-lg sm:rounded-2xl p-0.5 sm:p-2"
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
          <Square key={cell.id} cell={cell} occupants={getOccupants(cell.id)} isCapturing={captureAnimationCellId === cell.id} finishedPieces={finishedPieces} />
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
            onSpawnClick={handleSpawnClick}
          />
        ))}
        
        {selectedPiece && activeRoll && (
          <MoveSelector
            title={selectedPiece.isLocked ? "Spawn Piece" : isHomeStretchSelected ? "Home Stretch Move" : null}
            roll={activeRoll}
            validMoves={validMoves}
            possiblePairAttacks={possiblePairAttacks}
            onFullMove={handleFullMove}
            onSplitMove={handleSplitMove}
            onInitiatePairAttack={handleInitiatePairAttack}
            onClose={() => setSelectedPiece(null)}
            onNextRoll={handleNextRoll}
            hasMultipleRolls={state.turnQueue.length > 1}
          />
        )}
      </div>
    </div>
  );
};

export default Board;
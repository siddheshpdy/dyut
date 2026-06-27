import React, { useMemo, useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { generateBoardCells, PLAYER_PATHS, isSafeZone } from './boardMapping';
import { useGame, ACTION_TYPES } from './GameContext';
import MoveSelector from './MoveSelector';
import VictoryScreen from './VictoryScreen';
import { getValidMoves, getPairShieldTarget, canSpawnPiece, getProxyPlayerId } from './gameLogic';
import { usePrevious } from './usePrevious';
import { playSound } from './audio';

const getOccupantOffsetClass = (count, index, spreadPair = false) => {
  if (count === 2) {
    if (spreadPair) {
      return index === 0 ? '-translate-x-[24%]' : 'translate-x-[24%] z-20';
    }
    return index === 0 ? '-translate-x-[15%]' : 'translate-x-[15%] z-20';
  }

  if (count === 3) {
    return index === 0 ? '-translate-x-[15%] -translate-y-[15%]' : index === 1 ? 'translate-x-[15%] -translate-y-[15%] z-20' : 'translate-y-[15%] z-30';
  }

  if (count >= 4) {
    return index === 0 ? '-translate-x-[15%] -translate-y-[15%]' : index === 1 ? 'translate-x-[15%] -translate-y-[15%] z-20' : index === 2 ? '-translate-x-[15%] translate-y-[15%] z-30' : 'translate-x-[15%] translate-y-[15%] z-40';
  }

  return '';
};

const getOccupantSizeClass = (count, spreadPair = false) => {
  if (count === 2 && spreadPair) {
    return 'w-[68%] h-[68%] sm:w-[72%] sm:h-[72%]';
  }
  return 'w-[80%] h-[80%]';
};

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
        relative flex items-center justify-center transition-colors border border-white/40 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]
        ${isCenter ? 'board-goal-tile' : cell.isSafe ? 'board-safe-tile' : 'board-path-tile'}
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="absolute w-[80%] h-[80%] rounded-full bg-ruby animate-blood-splatter mix-blend-screen"></div>
          <div className="absolute w-[120%] h-[120%] rounded-full border-[4px] sm:border-[6px] border-ruby shadow-[0_0_30px_rgba(220,38,38,1)] animate-shockwave"></div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[85%] h-[85%] text-white drop-shadow-[0_0_15px_rgba(220,38,38,1)] animate-kill-pop">
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
      )}

      {/* Render Occupying Pieces */}
      {occupants && occupants.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {(() => {
            const spreadPair = occupants.length === 2 && occupants.every(occ => occ.isMovable);
            return occupants.map((occ, i) => {
              const offsetClass = getOccupantOffsetClass(occupants.length, i, spreadPair);
              const sizeClass = getOccupantSizeClass(occupants.length, spreadPair);
              return (
                <div key={i} className={`absolute ${sizeClass} flex items-center justify-center transition-all ${occ.isMovable ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${offsetClass}`} style={{ pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); occ.onClick(); }}>
                  <Piece color={occ.color} isMovable={occ.isMovable} isHomeStretch={occ.isHomeStretch} playerId={occ.playerId} pieceIndex={occ.pieceIndex} />
                </div>
              );
            });
          })()}
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
    ringClass = 'animate-pulse ring-2 sm:ring-[3px] ring-cyan-300 ring-offset-1 sm:ring-offset-2 ring-offset-black/50 shadow-[0_0_10px_rgba(34,211,238,0.6)]';
  } else if (isMovable) {
    ringClass = 'animate-pulse ring-2 sm:ring-[3px] ring-white/90 ring-offset-1 sm:ring-offset-2 ring-offset-black/50';
  } else if (isHomeStretch) {
    ringClass = 'ring-2 sm:ring-4 ring-cyan-400 ring-offset-1 sm:ring-offset-2 ring-offset-black/50';
  }

  const shapeClass = isHomeStretch
    ? 'w-[70%] sm:w-[75%] h-[80%] sm:h-[85%] rounded-t-full rounded-b-[10px] shadow-[inset_-2px_-4px_8px_rgba(0,0,0,0.5),0_5px_8px_rgba(0,0,0,0.6)]'
    : 'w-[70%] sm:w-[80%] aspect-square rounded-full shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.4)]';

  const innerShapeClass = isHomeStretch
    ? 'w-[35%] aspect-square bg-white/90 shadow-[inset_0_-2px_3px_rgba(0,0,0,0.4)] -translate-y-[15%]'
    : 'w-[35%] h-[35%] bg-white/80 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3)]';

  const homeStretchDirectionClass = isHomeStretch ? ({
    Player1: 'rotate-0',
    Player2: '-rotate-90',
    Player3: 'rotate-180',
    Player4: 'rotate-90',
  }[playerId] || '') : '';

  return (
    <div className={`flex items-center justify-center border-[1.5px] border-white/60 ${shapeClass} ${bgClass} ${ringClass} ${homeStretchDirectionClass}`}>
      <div className={`rounded-full pointer-events-none ${innerShapeClass}`}></div>
    </div>
  );
};

// The Player's Yard/Base for locked pieces
const PlayerBase = ({ playerId, player, gridRow, gridCol, onSpawnClick, isAnimating, isActive, layoutMode = 'desktop' }) => {
  const { state } = useGame();
  
  const isRollingPhaseActive = state.hasRolledThisTurn && !state.rollingPhaseComplete;

  // Find indices of locked pieces
  const lockedIndices = player.pieces.map((pos, i) => pos === -1 ? i : -1).filter(i => i !== -1);
  
  const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
  const isBotPlaying = state.bots?.includes(activePlayerId) || state.isAfkTurn;
  const isMyTurn = !state.isOnline || state.playerUids?.[activePlayerId] === state.localUid || (isBotPlaying && state.localUid === state.hostUid);
  const hasValidSpawn = state.turnQueue.some(r => r.d1 === r.d2 && canSpawnPiece(playerId, r.sum, state));
  const canSpawn = isMyTurn && !isBotPlaying && activePlayerId === playerId && hasValidSpawn && !isRollingPhaseActive && !isAnimating;

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

  const baseWrapperClass = layoutMode === 'mobile'
    ? 'relative flex flex-col items-center justify-center p-0'
    : 'relative flex flex-col items-center justify-center p-0 sm:p-2 lg:p-2';

  const baseCardClass = layoutMode === 'mobile'
    ? `relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg border px-1.5 py-1.5 transition-all duration-500 ${isActive ? 'border-gold/85 bg-black/60 shadow-[0_0_20px_rgba(234,179,8,0.32),inset_0_0_18px_rgba(234,179,8,0.08)]' : 'border-gold/24 bg-black/46 shadow-[inset_0_0_16px_rgba(0,0,0,0.68)]'}`
    : `relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-2 transition-all duration-500 sm:rounded-2xl lg:px-4 lg:py-4 ${isActive ? 'border-gold/90 bg-black/62 shadow-[0_0_34px_rgba(234,179,8,0.5),inset_0_0_30px_rgba(234,179,8,0.08)]' : 'border-gold/28 bg-black/46 shadow-[inset_0_0_24px_rgba(0,0,0,0.68)]'}`;

  const pieceGridClass = layoutMode === 'mobile'
    ? `grid w-full max-w-[52px] grid-cols-4 gap-0.5 rounded-md p-0.5 transition-all duration-500 ${isActive ? 'border border-gold/72 bg-black/64 shadow-[0_0_11px_rgba(234,179,8,0.22),inset_0_2px_8px_rgba(0,0,0,0.64)]' : 'border border-gold/24 bg-black/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.64)]'}`
    : `grid aspect-square w-[70%] max-w-[80px] grid-cols-2 grid-rows-2 gap-1 rounded-xl p-1 transition-all duration-500 sm:w-[80%] sm:max-w-[100px] sm:gap-2 sm:p-2 lg:w-full lg:max-w-[116px] lg:p-3 ${isActive ? 'border border-gold/85 bg-black/68 shadow-[0_0_22px_rgba(234,179,8,0.34),inset_0_4px_14px_rgba(0,0,0,0.64)]' : 'border border-gold/30 bg-black/54 shadow-[inset_0_4px_14px_rgba(0,0,0,0.64)]'}`;

  return (
    <div
      style={{ gridRow, gridColumn: gridCol }}
      className={baseWrapperClass}
    >
      {isActive && (
        <div className="absolute -top-4 left-1/2 hidden -translate-x-1/2 text-gold drop-shadow-[0_0_12px_rgba(234,179,8,0.95)] lg:block">
          <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5 18h14l1-10-5 4-3-7-3 7-5-4 1 10zm-1 2h16v2H4v-2z" />
          </svg>
        </div>
      )}
      <div className={baseCardClass}>
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent"></span>
      <span className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent"></span>
      <div className="mb-1 sm:mb-2 flex flex-col items-center">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Avatar/Color Indicator */}
          <div className={`h-2 w-2 rounded-full border border-white/40 jewel-shadow sm:h-4 sm:w-4 ${baseColorClass}`}></div>
          <span className={`max-w-[40px] truncate font-display text-[8px] font-bold tracking-[0.1em] transition-all duration-300 sm:max-w-none sm:text-xs sm:tracking-widest md:text-sm ${layoutMode === 'mobile' ? 'lg:text-sm' : 'lg:text-lg'} ${isActive ? 'text-gold text-glow-gold' : 'player-gold-text'}`}>{player.name || playerId}</span>
          {state.isTeamMode && (
            <span className={`ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[6px] sm:text-[8px] font-sans font-bold uppercase tracking-widest rounded border ${player.team === 1 ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30' : 'bg-rose-500/20 text-rose-200 border-rose-500/30'}`} title={`Team ${player.team}`}>
              T{player.team}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex gap-1 sm:mt-2 sm:gap-2" title={player.hasKilled ? "Blood Debt Paid" : "No Kills"}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 sm:h-5 sm:w-5 transition-all duration-500 ${player.hasKilled ? 'ruby-kill-icon drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] scale-110' : 'text-white/20'}`}>
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
      <div className={pieceGridClass}>
        {lockedIndices.map((pieceIndex) => (
          <div key={pieceIndex} className={`flex items-center justify-center transition-transform ${canSpawn ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`} onClick={() => { if (canSpawn) onSpawnClick(playerId, pieceIndex); }}>
            <Piece color={player.color} isMovable={canSpawn} playerId={playerId} pieceIndex={pieceIndex} />
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

// The main Board container
const Board = ({ onGoToMenu, layoutMode = 'desktop' }) => {
  const { state, dispatch } = useGame();
  const [visualPlayers, setVisualPlayers] = useState(state.players);
  const prevVisualPlayers = usePrevious(visualPlayers);
  const [selectedPiece, setSelectedPiece] = useState(null); // e.g., { playerId, pieceIndex, rollIndex }
  const [captureAnimationCellId, setCaptureAnimationCellId] = useState(null);
  // Generate the 97 cells (96 path squares + 1 center) exactly once
  const cells = useMemo(() => generateBoardCells(), []);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dyut_muted') === 'true');
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    const handler = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handler);
    return () => window.removeEventListener('dyut-mute-change', handler);
  }, []);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  
  const isRollingPhaseActive = state.hasRolledThisTurn && !state.rollingPhaseComplete;

  // Map the 4 players to the 4 empty corners of the 19x19 grid
  const allBases = layoutMode === 'mobile'
    ? [
        { id: 'Player1', row: '15 / span 4', col: '2 / span 4' },
        { id: 'Player2', row: '15 / span 4', col: '15 / span 4' },
        { id: 'Player3', row: '2 / span 4', col: '15 / span 4' },
        { id: 'Player4', row: '2 / span 4', col: '2 / span 4' },
      ]
    : [
        { id: 'Player1', row: '14 / span 6', col: '2 / span 6' },  // South-West (Yellow)
        { id: 'Player2', row: '14 / span 6', col: '14 / span 6' }, // South-East (Black)
        { id: 'Player3', row: '2 / span 6', col: '14 / span 6' },  // North-East (Green)
        { id: 'Player4', row: '2 / span 6', col: '2 / span 6' },   // North-West (Blue)
      ];

  const activeBases = allBases.filter(base => visualPlayers[base.id]);
  const activeBasePlayerId = getProxyPlayerId(state.currentPlayer, state);
  const visibleBases = layoutMode === 'mobile'
    ? activeBases.filter(base => base.id !== activeBasePlayerId)
    : activeBases;
  const mobileVisibleBaseSlotsByCount = {
    1: [
      { row: '2 / span 4', col: '15 / span 4' },
    ],
    2: [
      { row: '2 / span 4', col: '2 / span 4' },
      { row: '2 / span 4', col: '15 / span 4' },
    ],
    3: [
      { row: '2 / span 4', col: '2 / span 4' },
      { row: '2 / span 4', col: '15 / span 4' },
      { row: '15 / span 4', col: '15 / span 4' },
    ],
  };
  const positionedVisibleBases = layoutMode === 'mobile'
    ? visibleBases.map((base, index) => {
        const mobileSlot = mobileVisibleBaseSlotsByCount[visibleBases.length]?.[index];
        return mobileSlot ? { ...base, row: mobileSlot.row, col: mobileSlot.col } : base;
      })
    : visibleBases;

  // --- Animation Engine ---
  // Steps visual state forward until it matches the true GameContext state
  useEffect(() => {
    let timeoutId;
    let needsForwardStep = false;
    let needsCaptureStep = false;
    let needsSpawnStep = false;
    let hasChanges = false;
    
    const next = JSON.parse(JSON.stringify(visualPlayers));

    for (const pId in state.players) {
      if (!next[pId]) {
        next[pId] = state.players[pId];
        hasChanges = true;
        continue;
      }
      if (next[pId].color !== state.players[pId].color) { next[pId].color = state.players[pId].color; hasChanges = true; }
      if (next[pId].name !== state.players[pId].name) { next[pId].name = state.players[pId].name; hasChanges = true; }
      if (next[pId].hasKilled !== state.players[pId].hasKilled) { next[pId].hasKilled = state.players[pId].hasKilled; hasChanges = true; }
      if (next[pId].team !== state.players[pId].team) { next[pId].team = state.players[pId].team; hasChanges = true; }
      
      for (let i = 0; i < 4; i++) {
        const actual = state.players[pId].pieces[i];
        const visual = next[pId].pieces[i];

        if (actual !== visual) {
          if (visual === -1 && actual !== -1) {
            needsSpawnStep = true;
          } else if (visual !== -1 && actual !== -1 && visual !== 999) {
            const isGoal = actual === 999;
            const target = isGoal ? PLAYER_PATHS[pId].length - 1 : actual;
            if (visual < target) {
              needsForwardStep = true;
            } else if (isGoal && visual === target) {
              needsCaptureStep = true;
            } else {
              needsCaptureStep = true; // Backward fallback snap
            }
          } else if (visual !== -1 && actual === -1) {
            needsCaptureStep = true;
          }
        }
      }
    }

    if (needsSpawnStep || needsForwardStep || needsCaptureStep || hasChanges) {
      for (const pId in state.players) {
        for (let i = 0; i < 4; i++) {
          const actual = state.players[pId].pieces[i];
          const visual = next[pId].pieces[i];

          if (actual !== visual) {
            if (needsSpawnStep) {
              if (visual === -1 && actual !== -1) {
                next[pId].pieces[i] = actual;
                hasChanges = true;
              }
            } else if (needsForwardStep) {
              if (visual !== -1 && actual !== -1 && visual !== 999) {
                const target = actual === 999 ? PLAYER_PATHS[pId].length - 1 : actual;
                if (visual < target) {
                  next[pId].pieces[i] = visual + 1;
                  hasChanges = true;
                }
              }
            } else if (needsCaptureStep) {
              if (visual !== -1 && actual === -1) {
                next[pId].pieces[i] = -1;
                hasChanges = true;
              } else if (actual === 999 && visual === PLAYER_PATHS[pId].length - 1) {
                next[pId].pieces[i] = 999;
                hasChanges = true;
              } else if (visual !== -1 && actual !== -1 && visual > actual) {
                next[pId].pieces[i] = actual;
                hasChanges = true;
              }
            }
          }
        }
      }

      if (hasChanges) {
        timeoutId = setTimeout(() => {
          flushSync(() => setVisualPlayers(next));
        }, needsForwardStep ? 90 : 250); // 90ms per hop, 250ms for spawns/captures/turn-changes
      }
    }

    return () => clearTimeout(timeoutId);
  }, [state.players, visualPlayers]);

  const isAnimating = useMemo(() => {
    for (const pId in state.players) {
      if (!visualPlayers[pId]) continue;
      for (let i = 0; i < 4; i++) {
        if (state.players[pId].pieces[i] !== visualPlayers[pId].pieces[i]) return true;
      }
    }
    return false;
  }, [state.players, visualPlayers]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dyut-animating', { detail: isAnimating }));
  }, [isAnimating]);

  const winnerInfo = useMemo(() => {
    if (state.isQuickGame) {
      const winnerEntry = Object.entries(visualPlayers).find(([id, player]) => player.pieces.some(p => p === 999));
      if (winnerEntry) {
        if (state.isTeamMode) {
          const winningTeam = winnerEntry[1].team;
          const teamPlayers = Object.entries(visualPlayers).filter(([id, p]) => p.team === winningTeam).map(e => e[1].name || e[0]);
          return { id: `Team ${winningTeam} (${teamPlayers.join(' & ')})`, data: {} };
        }
        return { id: winnerEntry[1].name || winnerEntry[0], data: winnerEntry[1] };
      }
      return null;
    }

    if (state.isTeamMode) {
      const teams = {};
      for (const [id, player] of Object.entries(visualPlayers)) {
        if (!teams[player.team]) teams[player.team] = { allFinished: true, players: [] };
        teams[player.team].players.push(id);
        if (!player.pieces.every(p => p === 999)) teams[player.team].allFinished = false;
      }
      const winningTeam = Object.entries(teams).find(([team, data]) => data.allFinished);
      if (winningTeam) {
        const teamNames = winningTeam[1].players.map(id => visualPlayers[id].name || id);
        return { id: `Team ${winningTeam[0]} (${teamNames.join(' & ')})`, data: {} };
      }
      return null;
    }

    const winnerEntry = Object.entries(visualPlayers).find(([id, player]) => player.pieces.every(p => p === 999));
    return winnerEntry ? { id: winnerEntry[1].name || winnerEntry[0], data: winnerEntry[1] } : null;
  }, [visualPlayers, state.isQuickGame, state.isTeamMode]);

  // CrazyGames SDK: Granular Gameplay Tracking
  const cgGameplayActive = useRef(false);
  useEffect(() => {
    if (!import.meta.env.VITE_IS_PORTAL) return;

    const startCgGameplay = async () => {
      if (cgGameplayActive.current || winnerInfo) return;
      cgGameplayActive.current = true;
      try {
        if (window.cgInitPromise) await window.cgInitPromise;
        window.CrazyGames.SDK.game.gameplayStart();
      } catch(e) {}
    };

    const stopCgGameplay = async () => {
      if (!cgGameplayActive.current) return;
      cgGameplayActive.current = false;
      try {
        if (window.cgInitPromise) await window.cgInitPromise;
        window.CrazyGames.SDK.game.gameplayStop();
      } catch(e) {}
    };

    if (winnerInfo) {
      stopCgGameplay();
      // Trigger CrazyGames Happy Time confetti overlay for the victory!
      try {
        if (window.CrazyGames?.SDK?.game?.happytime) {
          window.CrazyGames.SDK.game.happytime();
        }
      } catch(e) {}
    } else {
      startCgGameplay();
    }

    return () => {
      stopCgGameplay();
    };
  }, [winnerInfo]);

  const finishedPieces = useMemo(() => {
    const counts = [];
    Object.entries(visualPlayers).forEach(([playerId, player]) => {
      const count = player.pieces.filter(p => p === 999).length;
      if (count > 0) {
        counts.push({ playerId, count, color: player.color });
      }
    });
    return counts;
  }, [visualPlayers]);

  useEffect(() => {
    if (!prevVisualPlayers || !visualPlayers) return;

    for (const playerId in visualPlayers) {
        const prevPlayer = prevVisualPlayers[playerId];
        const currentPlayer = visualPlayers[playerId];

        if (prevPlayer && currentPlayer) {
            // Check for captures
            const prevLockedCount = prevPlayer.pieces.filter(p => p === -1).length;
            const currentLockedCount = currentPlayer.pieces.filter(p => p === -1).length;
            if (currentLockedCount > prevLockedCount) {
                if (!isMutedRef.current) playSound(`${import.meta.env.BASE_URL}sounds/capture.mp3`);
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
                if (!isMutedRef.current) playSound(`${import.meta.env.BASE_URL}sounds/goal.mp3`);
            }
        }
    }
  }, [visualPlayers, prevVisualPlayers]);

  // Clear selected piece and attack state when the turn changes to prevent stale UI
  useEffect(() => {
    setSelectedPiece(null);
  }, [state.currentPlayer]);

  const handlePieceClick = (playerId, pieceIndex) => {
    // Can only select pieces if it's your turn and you have rolls in the queue
    const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
    const isBotPlaying = state.bots?.includes(activePlayerId) || state.isAfkTurn;
    const isMyTurn = !state.isOnline || state.playerUids?.[activePlayerId] === state.localUid || (isBotPlaying && state.localUid === state.hostUid);

    if (!isMyTurn || isBotPlaying || activePlayerId !== playerId || state.turnQueue.length === 0 || isRollingPhaseActive || isAnimating) {
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

    const playerId = selectedPiece.playerId;
    const pieceCurrentPos = state.players[playerId].pieces[selectedPiece.pieceIndex];
    const secondPieceIndex = state.players[playerId].pieces.findIndex((pos, i) => i !== selectedPiece.pieceIndex && pos === pieceCurrentPos);

    if (secondPieceIndex !== -1) {
      dispatch({
        type: ACTION_TYPES.EXECUTE_PAIR_ATTACK,
        payload: { playerId, rollIndex: selectedPiece.rollIndex, firstPieceIndex: selectedPiece.pieceIndex, secondPieceIndex, targetCellId }
      });
    }

    setSelectedPiece(null); // Close the move selector
  };

  const handleDualSpawnAttack = () => {
    if (!selectedPiece || !selectedPiece.isLocked) return;
    
    const playerId = selectedPiece.playerId;
    const player = state.players[playerId];
    
    // Find two locked pieces
    const lockedIndices = player.pieces.map((p, i) => p === -1 ? i : -1).filter(i => i !== -1);
    
    // Find two identical double rolls in the queue
    const activeRoll = state.turnQueue[selectedPiece.rollIndex];
    const sum = activeRoll.sum;
    const doubleRollIndices = state.turnQueue.map((r, i) => r.sum === sum && r.d1 === r.d2 && r.d2 !== null ? i : -1).filter(i => i !== -1);
    
    if (lockedIndices.length >= 2 && doubleRollIndices.length >= 2) {
      dispatch({
        type: ACTION_TYPES.DUAL_SPAWN_ATTACK,
        payload: { playerId, pieceIndices: [lockedIndices[0], lockedIndices[1]], rollIndices: [doubleRollIndices[0], doubleRollIndices[1]] }
      });
    }
    setSelectedPiece(null);
  };

  let isHomeStretchSelected = false;
  if (selectedPiece && !selectedPiece.isLocked) {
    const logicalId = PLAYER_PATHS[selectedPiece.playerId][state.players[selectedPiece.playerId].pieces[selectedPiece.pieceIndex]];
    isHomeStretchSelected = logicalId && logicalId.includes('_HOME');
  }

  const handleSpawnClick = (playerId, pieceIndex) => {
    const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
    const isBotPlaying = state.bots?.includes(activePlayerId) || state.isAfkTurn;
    const isMyTurn = !state.isOnline || state.playerUids?.[activePlayerId] === state.localUid || (isBotPlaying && state.localUid === state.hostUid);

    if (!isMyTurn || isBotPlaying || activePlayerId !== playerId || isRollingPhaseActive) return;
    
    const validDoubleIndex = state.turnQueue.findIndex(r => r.d1 === r.d2 && canSpawnPiece(playerId, r.sum, state));
    if (validDoubleIndex !== -1) {
      setSelectedPiece({ playerId, pieceIndex, rollIndex: validDoubleIndex, isLocked: true });
    }
  };

  useEffect(() => {
    const handleMobileSpawn = (event) => {
      const { playerId, pieceIndex } = event.detail || {};
      if (typeof playerId !== 'string' || typeof pieceIndex !== 'number') return;
      handleSpawnClick(playerId, pieceIndex);
    };

    window.addEventListener('dyut-mobile-spawn', handleMobileSpawn);
    return () => window.removeEventListener('dyut-mobile-spawn', handleMobileSpawn);
  }, [state.currentPlayer, state.turnQueue, state.players, state.hasRolledThisTurn, state.rollingPhaseComplete, isAnimating]);

  const handleFullMove = (distance) => {
    if (!selectedPiece) return;
    if (selectedPiece.isLocked) {
      dispatch({
        type: ACTION_TYPES.SPAWN_PIECE,
        payload: { playerId: selectedPiece.playerId, pieceIndex: selectedPiece.pieceIndex, rollIndex: selectedPiece.rollIndex }
      });
    } else {
      dispatch({
        type: ACTION_TYPES.MOVE_WITH_FULL_ROLL,
        payload: { ...selectedPiece, distance }
      });
    }
    setSelectedPiece(null); 
  };

  const handleSplitMove = (distanceUsed) => {
    if (!selectedPiece || selectedPiece.isLocked) return;
    dispatch({
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
      return { sum: canSpawn === true, high: false, low: false, dualSpawn: canSpawn === 'DUAL_SPAWN' };
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

  // Render active pieces globally over the grid so they don't unmount and can use CSS transitions
  const renderActivePieces = () => {
    const cellGroups = {};
    const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
    const isBotPlaying = state.bots?.includes(activePlayerId) || state.isAfkTurn;
    const isMyTurn = !state.isOnline || state.playerUids?.[activePlayerId] === state.localUid || (isBotPlaying && state.localUid === state.hostUid);

    Object.entries(visualPlayers).forEach(([playerId, player]) => {
      player.pieces.forEach((pos, pieceIndex) => {
        if (pos !== -1 && pos !== 999) {
          const logicalId = PLAYER_PATHS[playerId][pos];
          const visualId = logicalId ? logicalId.replace('_HOME', '') : null;
          if (visualId) {
            if (!cellGroups[visualId]) cellGroups[visualId] = [];
            cellGroups[visualId].push({ playerId, player, pieceIndex, pos, logicalId });
          }
        }
      });
    });

    const piecesToRender = [];

    Object.entries(cellGroups).forEach(([cellId, occupants]) => {
      const targetCell = cells.find(c => c.id === cellId);
      if (!targetCell) return;
      const hasRolls = state.turnQueue.length > 0;
      const spreadMovablePair = occupants.length === 2 && occupants.every((occ) => {
        const isActiveOrProxy = occ.playerId === activePlayerId;
        return isMyTurn && !isBotPlaying && isActiveOrProxy && hasRolls && !isRollingPhaseActive && !isAnimating;
      });
      
      occupants.forEach((occ, i) => {
        const isActiveOrProxy = occ.playerId === activePlayerId;
        const isMovable = isMyTurn && !isBotPlaying && isActiveOrProxy && hasRolls && !isRollingPhaseActive && !isAnimating;
        const isHomeStretch = occ.logicalId.includes('_HOME');
        const offsetClass = getOccupantOffsetClass(occupants.length, i, spreadMovablePair);
        const sizeClass = getOccupantSizeClass(occupants.length, spreadMovablePair);

        piecesToRender.push(
          <div 
            key={`${occ.playerId}-${occ.pieceIndex}`}
            style={{ gridColumn: targetCell.gridCol || targetCell.gridColumn, gridRow: targetCell.gridRow }}
            className={`flex items-center justify-center transition-transform duration-100 ease-linear ${isMovable ? 'cursor-pointer hover:scale-110 z-50' : 'cursor-default z-40'} ${offsetClass}`}
            onClick={(e) => { e.stopPropagation(); handlePieceClick(occ.playerId, occ.pieceIndex); }}
          >
            <div className={`${sizeClass} flex items-center justify-center pointer-events-none`}>
              <Piece color={occ.player.color} isMovable={isMovable} isHomeStretch={isHomeStretch} playerId={occ.playerId} pieceIndex={occ.pieceIndex} />
            </div>
          </div>
        );
      });
    });
    
    return piecesToRender;
  };

  const boardShellClass = layoutMode === 'mobile'
    ? 'mx-auto h-full w-full px-1 sm:px-2'
    : 'mx-auto aspect-square w-full max-w-[96vw] sm:p-2 lg:h-[78vh] lg:max-h-[820px] lg:w-auto lg:max-w-none xl:max-h-[850px]';

  return (
    <div className={boardShellClass}>
      <div 
        className="grid h-full w-full rounded-lg p-0.5 drop-shadow-[0_0_34px_rgba(234,179,8,0.14)] board-bounding-box sm:rounded-2xl sm:p-2"
        style={{ 
          gridTemplateColumns: 'repeat(19, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(19, minmax(0, 1fr))'
        }}
      >
        {winnerInfo && <VictoryScreen winnerId={winnerInfo.id} onNewGame={onGoToMenu} />}

        {cells.map(cell => (
          <Square key={cell.id} cell={cell} isCapturing={captureAnimationCellId === cell.id} finishedPieces={finishedPieces} />
        ))}
        
        {/* Render Global Pieces */}
        {renderActivePieces()}
        
        {/* Render the 4 player bases */}
        {positionedVisibleBases.map(base => (
          <PlayerBase 
            key={base.id}
            playerId={base.id}
            player={visualPlayers[base.id]}
            gridRow={base.row}
            gridCol={base.col}
            onSpawnClick={handleSpawnClick}
            isAnimating={isAnimating}
            isActive={activeBasePlayerId === base.id}
            layoutMode={layoutMode}
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
            onDualSpawnAttack={handleDualSpawnAttack}
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

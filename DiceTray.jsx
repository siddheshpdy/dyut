import React, { useState, useMemo, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useGame, ACTION_TYPES } from './GameContext';
import { hasAnyPlayableMove, getAutoMove, getProxyPlayerId, canSpawnPiece } from './gameLogic';
import { playSound } from './audio';
import blehMochiGif from './assets/bleh-mochi.gif';
import { useAIBot } from './useAIBot';
import { useTranslation } from 'react-i18next';
import { DYUT_ICONS } from './dyut-icons';

const DICE_FACES = [1, 3, 4, 6];

// A single die face component, styled to look like a long die (pasa)
const Die = ({ value, isRolling, compact = false }) => (
  <div className={`flex items-center justify-center border border-gold/45 bg-black/45 shadow-[inset_0_0_18px_rgba(255,255,255,0.05),0_0_18px_rgba(0,0,0,0.55)] transition-transform ${compact ? 'h-[3.35rem] w-[3.35rem] rounded-lg' : 'h-14 w-14 rounded-xl sm:h-20 sm:w-20 lg:h-24 lg:w-24 lg:rounded-2xl lg:border-gold/55'} ${isRolling ? 'animate-shake' : ''}`}>
    <span className={`font-display font-bold text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] ${compact ? 'text-[1.65rem]' : 'text-3xl sm:text-5xl lg:text-6xl'}`}>{value}</span>
  </div>
);

const PanelPiece = ({ color, isLocked, isClickable, onClick }) => {
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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`flex aspect-square w-full items-center justify-center rounded-lg border transition-all ${isLocked ? 'border-gold/25 bg-black/45' : 'border-white/10 bg-black/18'} ${isClickable ? 'cursor-pointer hover:scale-105 hover:border-gold/55' : 'cursor-default'}`}
    >
      <div className={`flex h-[58%] w-[58%] items-center justify-center rounded-full border border-white/60 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.4)] ${bgClass} ${isLocked ? '' : 'opacity-60'}`}>
        <div className="h-[30%] w-[30%] rounded-full bg-white/80 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3)]"></div>
      </div>
    </button>
  );
};

const DiceTray = ({ layoutMode = 'desktop' }) => {
  const { state, dispatch } = useGame();
  const [lastRoll, setLastRoll] = useState({ d1: null, d2: null });
  const [isRolling, setIsRolling] = useState(false);
  const [showVoidGif, setShowVoidGif] = useState(false);
  const [isBoardAnimating, setIsBoardAnimating] = useState(false);
  const { t } = useTranslation();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dyut_muted') === 'true');
  const DiceIcon = DYUT_ICONS.dice;
  const CrownIcon = DYUT_ICONS.currentTurn;

  useEffect(() => {
    const handler = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handler);
    return () => window.removeEventListener('dyut-mute-change', handler);
  }, []);

  useEffect(() => {
    const handleAnim = (e) => setIsBoardAnimating(e.detail);
    window.addEventListener('dyut-animating', handleAnim);
    return () => window.removeEventListener('dyut-animating', handleAnim);
  }, []);

  const activeBots = state.isAfkTurn ? [...(state.bots || []), state.currentPlayer] : (state.bots || []);
  // Activate AI hook (it safely idles if the current player is not in state.bots)
  useAIBot(activeBots, state.botDifficulty || 'hard');

  const isBotPlaying = activeBots.includes(state.currentPlayer);

  const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
  const isMyTurn = !state.isOnline || state.playerUids?.[activePlayerId] === state.localUid || (isBotPlaying && state.localUid === state.hostUid);
  const isCurrentUserPlayer = !state.isOnline || state.playerUids?.[activePlayerId] === state.localUid;
  const activePlayer = state.players[activePlayerId];
  const isRollingPhaseActive = state.hasRolledThisTurn && !state.rollingPhaseComplete;
  const hasValidSpawn = state.turnQueue.some(r => r.d1 === r.d2 && canSpawnPiece(activePlayerId, r.sum, state));

  // Auto-dismiss Void Roll for both bots (fast) and humans (after a delay)
  useEffect(() => {
    if (showVoidGif) {
      const delay = isBotPlaying ? 600 : 2000;
      const timer = setTimeout(() => {
        setShowVoidGif(false);
        if (isMyTurn) dispatch({ type: ACTION_TYPES.END_TURN });
        setLastRoll({ d1: null, d2: null });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [showVoidGif, isBotPlaying, dispatch, isMyTurn]);

  const handleRoll = () => {
    if (isRolling || isEvaluating) return;
    
    if (!isMuted) playSound(`${import.meta.env.BASE_URL}sounds/dice-roll.mp3`);
    setIsRolling(true);

    const animationInterval = setInterval(() => {
      const d1 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const d2 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1, d2 });
    }, 80);

    // Use a strict timeout instead of audio events to prevent stranded listeners and multiple dispatches
    setTimeout(() => {
      clearInterval(animationInterval);

      const final_d1 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const final_d2 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1: final_d1, d2: final_d2 });

      setIsRolling(false);
      setIsEvaluating(true);

      // Introduce a 600ms gap for the user to perceive the final dice result before the game reacts
      setTimeout(() => {
        // CRITICAL: Check for Void Rule (1+3) before anything else
        if (state.isVoidRuleEnabled && ((final_d1 === 1 && final_d2 === 3) || (final_d1 === 3 && final_d2 === 1))) {
          if (Math.random() < 0.25) setShowVoidGif(true);
          dispatch({ type: ACTION_TYPES.CLEAR_QUEUE });
        } else {
          dispatch({
            type: ACTION_TYPES.ROLL_DICE,
            payload: { d1: final_d1, d2: final_d2, sum: final_d1 + final_d2 }
          });
        }
        setIsEvaluating(false);
      }, 600);
    }, 600);
  };

  const hasPlayableMoves = useMemo(() => hasAnyPlayableMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue]);
  const autoMoveAction = useMemo(() => getAutoMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue, state.hasRolledThisTurn, state.rollingPhaseComplete]);

  // --- New, Reload-Safe Turn Logic ---
  const hasRollsInQueue = state.turnQueue.length > 0;
  
  // A player can roll if they haven't rolled this turn OR they are still in their rolling phase (doubles streak).
  const canRoll = !state.hasRolledThisTurn || !state.rollingPhaseComplete;

  const isStuckUI = hasRollsInQueue && !hasPlayableMoves && !canRoll && !isRolling && !isEvaluating && !showVoidGif;

  useEffect(() => {
    // Don't auto-end if the player can still roll, is rolling, is evaluating, or is viewing the Void Roll popup
    if (canRoll || isRolling || isEvaluating || showVoidGif || !isMyTurn) return;

    // Pause all logic progression while pieces are actively moving on the board to prevent overlaps
    if (isBoardAnimating) return;

    // Automatically dispatch a move if the player only has exactly 1 valid option
    if (autoMoveAction) {
      const timer = setTimeout(() => {
        dispatch(autoMoveAction);
      }, 1200); // 1200ms delay to let the user visually track the move
      return () => clearTimeout(timer);
    }

    const isStuck = hasRollsInQueue && !hasPlayableMoves;
    const isDone = state.hasRolledThisTurn && !hasRollsInQueue;

    if (isStuck || isDone) {
      const timer = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.END_TURN });
        setLastRoll({ d1: null, d2: null });
      }, 1200); // 1.2-second delay, perfectly safe now because we wait for the board animation to finish.

      return () => clearTimeout(timer);
    }
  }, [state.hasRolledThisTurn, hasRollsInQueue, hasPlayableMoves, canRoll, isRolling, isEvaluating, showVoidGif, dispatch, autoMoveAction, isMyTurn, isBoardAnimating]);


const trayShellClass = layoutMode === 'mobile'
    ? 'relative z-10 flex w-full max-w-none flex-col items-center gap-2.5 rounded-[22px] border border-gold/45 bg-[#080604]/92 p-2.5 shadow-[0_0_42px_rgba(0,0,0,0.82),inset_0_0_36px_rgba(234,179,8,0.07)] transition-all duration-500 sm:rounded-[28px] sm:p-4'
    : 'relative z-10 flex w-full max-w-[98vw] flex-col items-center gap-4 rounded-2xl border border-gold/40 bg-black/55 p-4 shadow-[0_0_38px_rgba(0,0,0,0.72),inset_0_0_34px_rgba(234,179,8,0.06)] transition-all duration-500 sm:max-w-sm sm:rounded-3xl sm:p-6 lg:min-h-[660px] lg:w-[350px] lg:max-w-[350px] lg:justify-center lg:gap-7 lg:border-gold/55 lg:bg-[#050403]/68 lg:shadow-[0_0_44px_rgba(0,0,0,0.78),inset_0_0_40px_rgba(234,179,8,0.08)] xl:min-h-[700px]';

  return (
    <>
      {showVoidGif && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.3)] border border-ruby/30 text-center max-w-sm w-[90%]">
            <img src={blehMochiGif} alt="Void Roll" className="mx-auto rounded-2xl shadow-lg border border-white/10" />
            <p className="font-display text-gold text-3xl font-bold tracking-widest mt-6 drop-shadow-md">{t('voidRollTitle')}</p>
            <p className="font-sans text-white/70 mt-3 text-sm leading-relaxed">
              {t('voidRollDescPart1')}<strong className="text-ruby drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">{t('voidRuleStrong')}</strong>{t('voidRollDescPart2')}
            </p>
            {isBotPlaying ? (
              <div className="mt-8 w-full py-3 bg-ruby/30 text-white/80 font-sans font-bold text-lg rounded-xl border border-ruby/50 animate-pulse">
                {t('autoSkipping')}
              </div>
            ) : (
              <button 
                onClick={() => {
                  setShowVoidGif(false);
                  dispatch({ type: ACTION_TYPES.END_TURN });
                  setLastRoll({ d1: null, d2: null });
                }} 
                className="mt-8 w-full py-3 bg-ruby/90 text-white font-sans font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-ruby hover:scale-[1.03] transition-all"
              >
                {t('acceptFate')}
              </button>
            )}
          </div>
        </div>
      )}
      <div className={trayShellClass}>
        <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l border-t border-gold/70"></span>
        <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r border-t border-gold/70"></span>
        <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b border-l border-gold/70"></span>
        <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b border-r border-gold/70"></span>
        {isStuckUI && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl">
            <div className="bg-ruby text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.6)] flex flex-col items-center border border-white/20 animate-pulse">
              <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest text-center">{t('noValidMoves')}</span>
              <span className="font-sans text-xs sm:text-sm font-semibold opacity-80 mt-1 uppercase tracking-wider">{t('skippingTurn')}</span>
            </div>
          </div>
        )}
        <div className={`${layoutMode === 'mobile' ? 'grid w-full grid-cols-[minmax(0,1fr)_minmax(124px,148px)] gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(164px,208px)]' : 'flex w-full flex-row items-center justify-between gap-4 lg:flex-col lg:justify-center lg:gap-6'}`}>
          <div className={`${layoutMode === 'mobile' ? 'flex min-w-0 flex-col items-start rounded-2xl border border-gold/20 bg-black/28 px-3 py-2 shadow-[inset_0_0_18px_rgba(0,0,0,0.45)]' : 'flex flex-col items-start lg:w-full lg:items-center'}`}>
            <span className="mb-1 font-display text-xs uppercase tracking-[0.28em] text-white/65 lg:text-sm">{t('active')}</span>
            <div className={`${layoutMode === 'mobile' ? 'flex flex-wrap items-center gap-2' : ''}`}>
              <div className="font-display text-lg font-bold uppercase leading-none text-gold text-glow-gold sm:text-2xl lg:text-4xl">
                {state.players[state.currentPlayer]?.name || state.currentPlayer}
              </div>
              {layoutMode === 'mobile' && isCurrentUserPlayer && (
                <span className="rounded-md border border-ruby/30 bg-ruby/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  {t('you', 'YOU')}
                </span>
              )}
            </div>
            <div className={`${layoutMode === 'mobile' ? 'mt-2 grid w-full max-w-[7rem] grid-cols-4 gap-1 rounded-lg border border-gold/25 bg-black/34 p-1.5' : 'mt-5 hidden w-full items-center justify-center gap-3 text-gold/85 lg:flex'}`}>
              {layoutMode === 'mobile' ? (
                activePlayer?.pieces?.map((piecePosition, pieceIndex) => {
                  const isLocked = piecePosition === -1;
                  const canSpawnPieceFromTray = isLocked && isMyTurn && !isBotPlaying && hasValidSpawn && !isRollingPhaseActive && !isBoardAnimating;
                  return (
                    <PanelPiece
                      key={pieceIndex}
                      color={activePlayer?.color}
                      isLocked={isLocked}
                      isClickable={canSpawnPieceFromTray}
                      onClick={() => {
                        if (!canSpawnPieceFromTray) return;
                        window.dispatchEvent(new CustomEvent('dyut-mobile-spawn', {
                          detail: { playerId: activePlayerId, pieceIndex },
                        }));
                      }}
                    />
                  );
                })
              ) : (
                <>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold"></span>
                  <CrownIcon className="h-6 w-6 drop-shadow-[0_0_10px_rgba(234,179,8,0.65)]" aria-hidden="true" />
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold"></span>
                </>
              )}
            </div>
          </div>
          <div className={`${layoutMode === 'mobile' ? 'flex flex-col items-center rounded-2xl border border-gold/25 bg-black/34 px-2 py-2.5 shadow-[inset_0_0_20px_rgba(0,0,0,0.52)]' : 'flex flex-col items-center lg:w-full lg:rounded-2xl lg:border lg:border-gold/25 lg:bg-black/38 lg:p-5 lg:shadow-[inset_0_0_22px_rgba(0,0,0,0.6)]'}`}>
            <span className={`${layoutMode === 'mobile' ? 'mb-1.5 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-gold/85' : 'mb-2 hidden font-display text-sm font-bold uppercase tracking-widest text-gold lg:block'}`}>{t('currentDice', 'Current Dice')}</span>
            <div className="flex gap-2 sm:gap-4 lg:gap-5">
              <Die value={lastRoll.d1 || '-'} isRolling={isRolling} compact={layoutMode === 'mobile'} />
              <Die value={lastRoll.d2 || '-'} isRolling={isRolling} compact={layoutMode === 'mobile'} />
            </div>
          </div>
        </div>

        <div className={`${layoutMode === 'mobile' ? 'flex w-full flex-col items-stretch gap-2' : 'flex w-full flex-row items-stretch gap-3 sm:gap-4 lg:flex-col lg:items-center lg:gap-5'}`}>
          <button
            onClick={(e) => { if (isBotPlaying && e.isTrusted) return; handleRoll(); }}
            id="dice-roll-btn"
            disabled={!canRoll || isRolling || isEvaluating || showVoidGif || !isMyTurn}
            className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-yellow-200/60 bg-gradient-to-b from-yellow-300 via-gold to-amber-700 py-3 font-display text-lg font-bold uppercase tracking-wider text-charcoal shadow-[0_0_22px_rgba(234,179,8,0.36),inset_0_2px_10px_rgba(255,255,255,0.35)] transition-all hover:scale-[1.02] hover:brightness-110 disabled:scale-100 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-none disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none sm:py-4 sm:text-xl lg:w-full lg:rounded-2xl lg:py-4 lg:text-2xl ${layoutMode === 'mobile' ? 'w-full rounded-2xl py-2.5 text-base' : ''} ${isBotPlaying ? 'pointer-events-none opacity-90 grayscale-[0.2]' : ''}`}
          >
            <DiceIcon className={`${layoutMode === 'mobile' ? 'h-4.5 w-4.5' : 'h-5 w-5'}`} aria-hidden="true" />
            {isRolling ? t('rolling') : t('rollDice')}
          </button>
        
          <div className={`flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-xl border border-gold/35 bg-black/45 p-2 sm:min-h-[64px] sm:p-3 lg:min-h-[96px] lg:w-full lg:rounded-2xl lg:bg-black/38 lg:p-4 ${layoutMode === 'mobile' ? 'w-full rounded-2xl bg-black/34 p-2' : ''}`}>
            <span className={`${layoutMode === 'mobile' ? 'mb-1 block font-display text-[10px] uppercase tracking-[0.22em] text-gold/80' : 'mb-1 hidden text-[8px] uppercase tracking-widest text-white/50 sm:block sm:text-[10px] lg:mb-3 lg:block lg:font-display lg:text-xs lg:text-gold/80'}`}>{t('queue')}</span>
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 lg:gap-2.5">
            {state.turnQueue.length > 0 ? (
              state.turnQueue.map((roll, i) => {
                const rollText = roll.d2 == null ? roll.d1 : `${roll.d1} + ${roll.d2}`;
                return (
                  <span key={i} className={`font-bold px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm ${i === 0 ? 'bg-gold text-charcoal shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-white/10 text-white/70 border border-white/10'}`}>{rollText}</span>
                );
              })
            ) : (
              <span className="text-white/60 text-[10px] sm:text-xs italic">{t('empty')}</span>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiceTray;

import React, { useState, useMemo, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useGame, ACTION_TYPES } from './GameContext';
import { hasAnyPlayableMove, getAutoMove, getProxyPlayerId } from './gameLogic';
import { playSound } from './audio';
import blehMochiGif from './assets/bleh-mochi.gif';
import { useAIBot } from './useAIBot';
import { useTranslation } from 'react-i18next';

const DICE_FACES = [1, 3, 4, 6];

// A single die face component, styled to look like a long die (pasa)
const Die = ({ value, isRolling }) => (
  <div className={`w-12 h-16 sm:w-16 sm:h-24 glass-panel rounded-lg sm:rounded-xl shadow-2xl flex items-center justify-center border-t border-white/30 transition-transform ${isRolling ? 'animate-shake' : ''}`}>
    <span className="text-3xl sm:text-5xl font-display font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">{value}</span>
  </div>
);

const DiceTray = () => {
  const { state, dispatch } = useGame();
  const [lastRoll, setLastRoll] = useState({ d1: null, d2: null });
  const [isRolling, setIsRolling] = useState(false);
  const [showVoidGif, setShowVoidGif] = useState(false);
  const { t } = useTranslation();

  // Activate AI hook (it safely idles if the current player is not in state.bots)
  useAIBot(state.bots || [], state.botDifficulty || 'hard');

  const isBotPlaying = state.bots?.includes(state.currentPlayer);

  const activePlayerId = getProxyPlayerId(state.currentPlayer, state);
  const isMyTurn = !state.isOnline || state.playerUids[activePlayerId] === state.localUid || (isBotPlaying && state.localUid === state.hostUid);

  // Auto-dismiss Void Roll for both bots (fast) and humans (after a delay)
  useEffect(() => {
    if (showVoidGif) {
      const delay = isBotPlaying ? 1500 : 3000;
      const timer = setTimeout(() => {
        setShowVoidGif(false);
        if (isMyTurn) dispatch({ type: ACTION_TYPES.END_TURN });
        setLastRoll({ d1: null, d2: null });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [showVoidGif, isBotPlaying, dispatch, isMyTurn]);

  const handleRoll = () => {
    if (isRolling) return;
    
    const rollSound = playSound('./sounds/dice-roll.mp3');
    setIsRolling(true);

    const animationInterval = setInterval(() => {
      const d1 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const d2 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1, d2 });
    }, 80);

    // This function will execute once the dice roll sound has finished playing
    const onSoundEnd = () => {
      clearInterval(animationInterval);

      const final_d1 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const final_d2 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1: final_d1, d2: final_d2 });

      // CRITICAL: Check for Void Rule (1+3) before anything else
      if (state.isVoidRuleEnabled && ((final_d1 === 1 && final_d2 === 3) || (final_d1 === 3 && final_d2 === 1))) {
        setShowVoidGif(true);
        dispatch({ type: ACTION_TYPES.CLEAR_QUEUE, skipSync: true });
      } else {
        // Projected state for cost optimization (Batching Roll + AutoMove)
        const projectedQueue = [...state.turnQueue, { d1: final_d1, d2: final_d2, sum: final_d1 + final_d2 }];
        const projectedState = { ...state, turnQueue: projectedQueue, hasRolledThisTurn: true, rollingPhaseComplete: final_d1 !== final_d2 };
        
        const autoMoveNext = getAutoMove(state.currentPlayer, projectedState);
        const hasMovesNext = hasAnyPlayableMove(state.currentPlayer, projectedState);
        const isStuckNext = projectedState.turnQueue.length > 0 && !hasMovesNext && projectedState.rollingPhaseComplete;

        const shouldSkipSync = isBotPlaying || !!autoMoveNext || isStuckNext;

        // Dispatch the roll to the global state to be added to the queue
        dispatch({
          type: ACTION_TYPES.ROLL_DICE,
          payload: { d1: final_d1, d2: final_d2, sum: final_d1 + final_d2 },
          skipSync: shouldSkipSync
        });
      }
      
      setIsRolling(false);
    };

    // Listen for the 'ended' event on the audio object to sync animation and sound
    rollSound.addEventListener('ended', onSoundEnd, { once: true });
    rollSound.addEventListener('error', onSoundEnd, { once: true }); // Fallback if audio fails to load/play
  };

  const hasPlayableMoves = useMemo(() => hasAnyPlayableMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue]);
  const autoMoveAction = useMemo(() => getAutoMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue, state.hasRolledThisTurn, state.rollingPhaseComplete]);

  // --- New, Reload-Safe Turn Logic ---
  const hasRollsInQueue = state.turnQueue.length > 0;
  
  // A player can roll if they haven't rolled this turn OR they are still in their rolling phase (doubles streak).
  const canRoll = !state.hasRolledThisTurn || !state.rollingPhaseComplete;

  const isStuckUI = hasRollsInQueue && !hasPlayableMoves && !canRoll && !isRolling && !showVoidGif;

  useEffect(() => {
    // Don't auto-end if the player can still roll, is rolling, or is viewing the Void Roll popup
    if (canRoll || isRolling || showVoidGif || !isMyTurn) return;

    // Automatically dispatch a move if the player only has exactly 1 valid option
    if (autoMoveAction) {
      const timer = setTimeout(() => {
        if (document.startViewTransition) {
          document.startViewTransition(() => {
            flushSync(() => {
              dispatch(autoMoveAction);
            });
          });
        } else {
          dispatch(autoMoveAction);
        }
      }, 600); // 600ms delay to let the user visually track the move
      return () => clearTimeout(timer);
    }

    const isStuck = hasRollsInQueue && !hasPlayableMoves;
    const isDone = state.hasRolledThisTurn && !hasRollsInQueue;

    if (isStuck || isDone) {
      const timer = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.END_TURN });
        setLastRoll({ d1: null, d2: null });
      }, 1200); // 1.2-second delay for the player to see the result.

      return () => clearTimeout(timer);
    }
  }, [state.hasRolledThisTurn, hasRollsInQueue, hasPlayableMoves, canRoll, isRolling, showVoidGif, dispatch, autoMoveAction]);


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
      <div className="relative w-full max-w-[98vw] sm:max-w-sm lg:max-w-xs p-2 sm:p-6 flex flex-col items-center gap-3 sm:gap-6 z-10 glass-panel rounded-2xl sm:rounded-3xl transition-all duration-500">
        {isStuckUI && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl">
            <div className="bg-ruby text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.6)] flex flex-col items-center border border-white/20 animate-pulse">
              <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest text-center">{t('noValidMoves')}</span>
              <span className="font-sans text-xs sm:text-sm font-semibold opacity-80 mt-1 uppercase tracking-wider">{t('skippingTurn')}</span>
            </div>
          </div>
        )}
        <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center w-full gap-4">
          <div className="flex flex-col items-start lg:items-center">
            <span className="text-white/60 text-[10px] sm:text-xs font-sans uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-1">{t('active')}</span>
            <div className="text-gold font-display font-bold text-2xl sm:text-3xl drop-shadow-md uppercase text-glow-gold leading-none">
              {state.currentPlayer}
            </div>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <Die value={lastRoll.d1 || '—'} isRolling={isRolling} />
            <Die value={lastRoll.d2 || '—'} isRolling={isRolling} />
          </div>
        </div>

        <div className="w-full flex flex-row lg:flex-col gap-3 sm:gap-4 items-stretch lg:items-center">
          <button
            onClick={handleRoll}
            id="dice-roll-btn"
            disabled={!canRoll || isRolling || showVoidGif || !isMyTurn}
            className="flex-1 lg:w-full py-3 sm:py-4 bg-gold text-charcoal font-display font-bold text-lg sm:text-xl rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-105 disabled:bg-white/10 disabled:text-white/40 disabled:border disabled:border-white/5 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed transition-all"
          >
            {isRolling ? t('rolling') : t('rollDice')}
          </button>
        
          <div className="flex-1 lg:w-full flex flex-col items-center justify-center bg-black/40 rounded-xl p-2 sm:p-3 border border-white/5 min-h-[48px] sm:min-h-[64px]">
            <span className="text-white/50 text-[8px] sm:text-[10px] uppercase tracking-widest mb-1 sm:mb-2 hidden sm:block lg:block">{t('queue')}</span>
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
            {state.turnQueue.length > 0 ? (
              state.turnQueue.map((roll, i) => {
                const rollText = roll.d2 === null ? roll.d1 : `${roll.d1} + ${roll.d2}`;
                return (
                  <span key={i} className={`font-bold px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm ${i === 0 ? 'bg-gold text-charcoal shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-white/10 text-white/70 border border-white/10'}`}>{rollText}</span>
                );
              })
            ) : (
              <span className="text-white/30 text-[10px] sm:text-xs italic">{t('empty')}</span>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiceTray;
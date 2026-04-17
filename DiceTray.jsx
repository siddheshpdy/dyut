import React, { useState, useMemo, useEffect } from 'react';
import { useGame, ACTION_TYPES } from './GameContext';
import { hasAnyPlayableMove } from './gameLogic';
import { playSound } from './audio';
import blehMochiGif from './assets/bleh-mochi.gif';

const DICE_FACES = [1, 3, 4, 6];

// A single die face component, styled to look like a long die (pasa)
const Die = ({ value, isRolling }) => (
  <div className={`w-16 h-24 glass-panel rounded-xl shadow-2xl flex items-center justify-center border-t border-white/30 transition-transform ${isRolling ? 'animate-shake' : ''}`}>
    <span className="text-5xl font-display font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">{value}</span>
  </div>
);

const DiceTray = () => {
  const { state, dispatch } = useGame();
  const [lastRoll, setLastRoll] = useState({ d1: null, d2: null });
  const [isRolling, setIsRolling] = useState(false);
  const [showVoidGif, setShowVoidGif] = useState(false);

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
        dispatch({ type: ACTION_TYPES.CLEAR_QUEUE });
        dispatch({ type: ACTION_TYPES.END_TURN });
        setLastRoll({ d1: null, d2: null });
      } else {
        // Dispatch the roll to the global state to be added to the queue
        dispatch({
          type: ACTION_TYPES.ROLL_DICE,
          payload: { d1: final_d1, d2: final_d2, sum: final_d1 + final_d2 }
        });
      }
      
      setIsRolling(false);
    };

    // Listen for the 'ended' event on the audio object to sync animation and sound
    rollSound.addEventListener('ended', onSoundEnd, { once: true });
    rollSound.addEventListener('error', onSoundEnd, { once: true }); // Fallback if audio fails to load/play
  };

  const hasPlayableMoves = useMemo(() => hasAnyPlayableMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue]);

  // --- New, Reload-Safe Turn Logic ---
  const hasRollsInQueue = state.turnQueue.length > 0;
  const lastQueuedRoll = hasRollsInQueue ? state.turnQueue[state.turnQueue.length - 1] : null;
  const isDoublesStreak = lastQueuedRoll ? lastQueuedRoll.d1 === lastQueuedRoll.d2 && lastQueuedRoll.d2 !== null : false;
  
  // A player can roll if they haven't rolled this turn OR they are on a doubles streak.
  const canRoll = !state.hasRolledThisTurn || isDoublesStreak;

  useEffect(() => {
    // Don't auto-end if the player can still roll (e.g., on a doubles streak).
    if (canRoll || isRolling) return;

    const isStuck = hasRollsInQueue && !hasPlayableMoves;
    const isDone = state.hasRolledThisTurn && !hasRollsInQueue;

    if (isStuck || isDone) {
      const timer = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.END_TURN });
        setLastRoll({ d1: null, d2: null });
      }, 1200); // 1.2-second delay for the player to see the result.

      return () => clearTimeout(timer);
    }
  }, [state.hasRolledThisTurn, hasRollsInQueue, hasPlayableMoves, canRoll, isRolling, dispatch]);

  // Dynamically position the tray on tablet (md) screens to avoid the active player's base.
  // Player 1 (SW) & Player 4 (NW) are on the left. Player 2 (SE) & Player 3 (NE) are on the right.
  const mdPositionClass = (state.currentPlayer === 'Player2' || state.currentPlayer === 'Player3')
    ? 'md:left-4 md:right-auto md:translate-x-0' // Move tray to the bottom-left
    : 'md:right-4 md:left-auto md:translate-x-0'; // Move tray to the bottom-right

  return (
    <>
      {showVoidGif && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-800 p-6 rounded-xl shadow-2xl text-center border-2 border-red-700">
            <img src={blehMochiGif} alt="Void Roll" className="mx-auto rounded-lg" />
            <p className="text-white font-bold text-2xl mt-4">Void Roll!</p>
            <p className="text-white/80">Your turn is forfeit.</p>
            <button 
              onClick={() => setShowVoidGif(false)} 
              className="mt-6 px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
            >
              Bleh.
            </button>
          </div>
        </div>
      )}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${mdPositionClass} lg:relative lg:left-auto lg:bottom-auto lg:right-auto lg:translate-x-0 w-full max-w-xs p-6 flex flex-col items-center gap-6 z-10 glass-panel rounded-3xl transition-all duration-500`}>
        <div className="flex flex-col items-center">
          <span className="text-white/60 text-xs font-sans uppercase tracking-[0.3em] mb-1">Active Player</span>
          <div className="text-gold font-display font-bold text-3xl drop-shadow-md uppercase text-glow-gold">
            {state.currentPlayer}
          </div>
        </div>

        <div className="flex gap-4">
          <Die value={lastRoll.d1 || '—'} isRolling={isRolling} />
          <Die value={lastRoll.d2 || '—'} isRolling={isRolling} />
        </div>

        <div className="w-full mt-2">
          <button
            onClick={handleRoll}
            disabled={!canRoll || isRolling}
            className="w-full py-4 bg-gold text-charcoal font-display font-bold text-xl rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:bg-yellow-400 hover:scale-105 disabled:bg-gray-600 disabled:text-gray-400 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed transition-all"
          >
            {isRolling ? 'ROLLING...' : 'ROLL DICE'}
          </button>
        </div>
        
        <div className="w-full flex flex-col items-center bg-black/40 rounded-xl p-3 border border-white/5">
          <span className="text-white/50 text-[10px] uppercase tracking-widest mb-2">Queue</span>
          <div className="flex items-center justify-center gap-2 flex-wrap min-h-[32px]">
            {state.turnQueue.length > 0 ? (
              state.turnQueue.map((roll, i) => {
                const rollText = roll.d2 === null ? roll.d1 : `${roll.d1} + ${roll.d2}`;
                return (
                  <span key={i} className={`font-bold px-3 py-1 rounded-lg text-sm ${i === 0 ? 'bg-gold text-charcoal shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-white/10 text-white/70 border border-white/10'}`}>{rollText}</span>
                );
              })
            ) : (
              <span className="text-white/30 text-xs italic">Empty</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DiceTray;
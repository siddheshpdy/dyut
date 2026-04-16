import React, { useState, useMemo } from 'react';
import { useGame, ACTION_TYPES } from './GameContext';
import { hasAnyPlayableMove } from './gameLogic';
import { playSound } from './audio';
import blehMochiGif from './assets/bleh-mochi.gif';

const DICE_FACES = [1, 3, 4, 6];

// A single die face component, styled to look like a long die (pasa)
const Die = ({ value, isRolling }) => (
  <div className={`w-16 h-20 bg-amber-100 rounded-lg shadow-lg flex items-center justify-center border-2 border-amber-300 transition-transform ${isRolling ? 'animate-shake' : ''}`}>
    <span className="text-4xl font-bold text-neutral-800">{value}</span>
  </div>
);

const DiceTray = ({ onGoToMenu }) => {
  const { state, dispatch } = useGame();
  const [lastRoll, setLastRoll] = useState({ d1: null, d2: null });
  const [isRolling, setIsRolling] = useState(false);
  const [showVoidGif, setShowVoidGif] = useState(false);

  const handleRoll = () => {
    if (isRolling) return;
    
    const rollSound = playSound('/sounds/dice-roll.mp3'); // Assuming sound is in public/sounds/
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
      if ((final_d1 === 1 && final_d2 === 3) || (final_d1 === 3 && final_d2 === 1)) {
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
  };
  
  const handleEndTurn = () => {
    dispatch({ type: ACTION_TYPES.END_TURN });
    setLastRoll({ d1: null, d2: null });
  };

  const handleResetGame = () => {
    if (window.confirm("Are you sure you want to reset the game? All progress will be lost.")) {
      dispatch({ type: ACTION_TYPES.RESET_GAME });
    }
  };

  const hasPlayableMoves = useMemo(() => hasAnyPlayableMove(state.currentPlayer, state), [state]);

  // Determine rolling and turn ending permissions
  const hasRolled = lastRoll.d1 !== null;
  const lastWasDouble = hasRolled && lastRoll.d1 === lastRoll.d2;
  
  // Can roll if they haven't rolled yet, or if they are on a doubles streak
  const canRoll = !hasRolled || lastWasDouble;
  
  // Can end turn if queue is empty (and not on a streak), or if queue has rolls but none are playable.
  const canEndTurn = (state.turnQueue.length === 0 && hasRolled && !lastWasDouble) || (state.turnQueue.length > 0 && !hasPlayableMoves);

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
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${mdPositionClass} lg:relative lg:left-auto lg:bottom-auto lg:right-auto lg:translate-x-0 w-full max-w-xs p-4 flex flex-col items-center gap-4 z-10 transition-all duration-500`}>
        <div className="text-white font-bold text-xl drop-shadow-md">
          {state.currentPlayer}'s Turn
        </div>
        <div className="flex gap-4">
          <Die value={lastRoll.d1 || '—'} isRolling={isRolling} />
          <Die value={lastRoll.d2 || '—'} isRolling={isRolling} />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleRoll}
            disabled={!canRoll || isRolling}
            className="px-6 py-2 bg-green-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRolling ? 'Rolling...' : 'Roll Dice'}
          </button>
          
          <button
            onClick={handleEndTurn}
            disabled={!canEndTurn}
            className="px-6 py-2 bg-red-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            End Turn
          </button>
        </div>
        
        <div className="mt-4 border-t border-white/10 pt-4 w-full flex justify-center gap-4">
          <button
            onClick={handleResetGame}
            className="px-4 py-1 bg-red-800 text-white font-semibold text-sm rounded-md shadow-md hover:bg-red-700 transition-colors"
          >
            Reset Progress
          </button>
          <button
            onClick={onGoToMenu}
            className="px-4 py-1 bg-amber-600 text-white font-semibold text-sm rounded-md shadow-md hover:bg-amber-700 transition-colors"
          >
            New Game
          </button>
        </div>

        <div className="text-white text-center text-sm min-h-[40px] p-2 bg-black/20 rounded-md flex items-center justify-center gap-2 flex-wrap">
          <span>Queue:</span>
          {state.turnQueue.length > 0 ? (
            state.turnQueue.map((roll, i) => {
              const rollText = roll.d2 === null ? roll.d1 : `${roll.d1} + ${roll.d2}`;
              return (
                <span key={i} className={`font-bold px-2 py-1 rounded-md ${i === 0 ? 'bg-yellow-400 text-black' : 'bg-white/20'}`}>{rollText}</span>
              );
            })
          ) : (
            <span>Empty</span>
          )}
        </div>
      </div>
    </>
  );
};

export default DiceTray;
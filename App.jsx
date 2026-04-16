import React, { useState, useEffect } from 'react';
import Board from './Board';
import DiceTray from './DiceTray';
import GameSetup from './GameSetup';
import { GameProvider } from './GameContext';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';

function App() {
  const [playerCount, setPlayerCount] = useState(() => {
    const savedCount = localStorage.getItem(PLAYER_COUNT_KEY);
    return savedCount ? parseInt(savedCount, 10) : null;
  });

  useEffect(() => {
    if (playerCount) {
      localStorage.setItem(PLAYER_COUNT_KEY, playerCount);
    } else {
      localStorage.removeItem(PLAYER_COUNT_KEY);
    }
  }, [playerCount]);

  const handleGoToMenu = () => {
    // Clear all game-related storage to ensure a fresh start
    localStorage.removeItem(PLAYER_COUNT_KEY);
    localStorage.removeItem(GAME_STATE_KEY);
    setPlayerCount(null);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-900 flex items-center justify-center gap-8 overflow-hidden p-4">
      {!playerCount ? (
        <GameSetup onSelect={setPlayerCount} />
      ) : (
        <GameProvider playerCount={playerCount}>
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full">
            <Board onGoToMenu={handleGoToMenu} />
            <DiceTray onGoToMenu={handleGoToMenu} />
          </div>
        </GameProvider>
      )}
    </div>
  )
}

export default App
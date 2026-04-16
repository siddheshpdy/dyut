import React, { useState } from 'react';
import Board from './Board';
import DiceTray from './DiceTray';
import GameSetup from './GameSetup';
import { GameProvider } from './GameContext';

function App() {
  const [playerCount, setPlayerCount] = useState(null);

  const handleGoToMenu = () => {
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
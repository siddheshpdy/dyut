import React, { useState, useEffect } from 'react';
import Board from './Board';
import DiceTray from './DiceTray';
import GameSetup from './GameSetup';
import MainMenu from './MainMenu';
import RulesScreen from './RulesScreen';
import { GameProvider } from './GameContext';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';

function App() {
  const [view, setView] = useState('menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(null); // { playerCount, playerColors, isVoidRuleEnabled }

  const hasCachedGame = !!localStorage.getItem(GAME_STATE_KEY) && !!localStorage.getItem(PLAYER_COUNT_KEY);

  const handleStartNewGame = () => {
    if (hasCachedGame) {
      if (window.confirm("A saved game exists. Starting a new game will wipe your progress. Are you sure?")) {
        localStorage.removeItem(PLAYER_COUNT_KEY);
        localStorage.removeItem(GAME_STATE_KEY);
        setView('setup');
      }
    } else {
      setView('setup');
    }
  };

  const handleResumeGame = () => {
    const savedCount = localStorage.getItem(PLAYER_COUNT_KEY);
    // We don't need to load the full config, just enough for the provider to work.
    // The provider itself will load the full state from storage.
    setGameConfig({ playerCount: parseInt(savedCount, 10) });
    setView('game');
  };

  const handleGameSetupComplete = (config) => {
    localStorage.setItem(PLAYER_COUNT_KEY, config.playerCount);
    setGameConfig(config);
    setView('game');
  };

  const handleGoToMenu = () => {
    localStorage.removeItem(PLAYER_COUNT_KEY);
    localStorage.removeItem(GAME_STATE_KEY);
    setGameConfig(null);
    setView('menu');
  };

  const renderView = () => {
    switch (view) {
      case 'rules':
        return <RulesScreen onBack={() => setView('menu')} />;
      case 'setup':
        return <GameSetup onGameSetupComplete={handleGameSetupComplete} />;
      case 'game':
        return (
          <GameProvider gameConfig={gameConfig}>
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full">
              <Board onGoToMenu={handleGoToMenu} />
              <DiceTray onGoToMenu={handleGoToMenu} />
            </div>
          </GameProvider>
        );
      case 'menu':
      default:
        return <MainMenu onStart={handleStartNewGame} onResume={handleResumeGame} onShowRules={() => setView('rules')} canResume={hasCachedGame} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-900 flex items-center justify-center gap-8 overflow-hidden p-4">
      {renderView()}
    </div>
  )
}

export default App
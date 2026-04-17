import React, { useState, useEffect } from 'react';
import Board from './Board';
import DiceTray from './DiceTray';
import UnifiedLobby from './UnifiedLobby';
import RulesScreen from './RulesScreen';
import { GameProvider } from './GameContext';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';

function App() {
  const [view, setView] = useState('menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(null); // { playerCount, playerColors, isVoidRuleEnabled }

  const hasCachedGame = !!localStorage.getItem(GAME_STATE_KEY) && !!localStorage.getItem(PLAYER_COUNT_KEY);

  const handleStartNewGame = (config) => {
    if (hasCachedGame) {
      if (window.confirm("A saved game exists. Starting a new game will wipe your progress. Are you sure?")) {
        localStorage.removeItem(PLAYER_COUNT_KEY);
        localStorage.removeItem(GAME_STATE_KEY);
        handleGameSetupComplete(config);
      }
    } else {
      handleGameSetupComplete(config);
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
        return (
          <div className="relative z-10 w-full flex justify-center">
            <RulesScreen onBack={() => setView('menu')} />
          </div>
        );
      case 'game':
        return (
          <GameProvider gameConfig={gameConfig}>
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full z-10 relative">
              <Board onGoToMenu={handleGoToMenu} />
              <DiceTray onGoToMenu={handleGoToMenu} />
            </div>
          </GameProvider>
        );
      case 'menu':
      default:
        return <UnifiedLobby onStartGame={handleStartNewGame} onResumeGame={handleResumeGame} onShowRules={() => setView('rules')} hasCachedGame={hasCachedGame} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-charcoal flex items-center justify-center gap-8 overflow-hidden p-4 relative">
      {/* Abstract Blurred Board Background for Menus */}
      {view !== 'game' && (
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 blur-xl pointer-events-none">
          <div className="w-[90vmin] h-[90vmin] relative">
            <div className="absolute top-0 bottom-0 left-1/3 right-1/3 bg-dyut-board shadow-2xl rounded-3xl" />
            <div className="absolute left-0 right-0 top-1/3 bottom-1/3 bg-dyut-board shadow-2xl rounded-3xl" />
          </div>
        </div>
      )}
      {renderView()}
    </div>
  )
}

export default App
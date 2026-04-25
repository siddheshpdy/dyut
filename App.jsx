import React, { useState, useEffect } from 'react';
import Board from './Board';
import DiceTray from './DiceTray';
import UnifiedLobby from './UnifiedLobby';
import RulesScreen from './RulesScreen';
import { GameProvider, useGame } from './GameContext';
import blehMochiGif from './assets/bleh-mochi.gif';
import { auth, signInUserAnonymously } from './firebaseSetup.js';
import { onIdTokenChanged } from 'firebase/auth';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';
const ONLINE_GAME_ID_KEY = 'dyut_last_online_id';

const GameOverlay = ({ onShowRules, onReturnToMenu }) => {
  const { state, leaveGame } = useGame();
  
  const handleMenuClick = () => {
    const msg = state.isPublic && state.isOnline
      ? "Leave the match? You will be replaced by a bot and cannot rejoin."
      : "Return to main menu? Progress will be saved.";
    if (window.confirm(msg)) {
      if (state.isOnline && leaveGame) leaveGame();
      onReturnToMenu();
    }
  };

  return (
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-3 z-50">
      <button onClick={onShowRules} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-gold transition-colors" title="Rules">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
      </button>
      <button onClick={handleMenuClick} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-ruby transition-colors" title="Menu / Pause">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
    </div>
  );
};

function App() {
  const [view, setView] = useState('menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(null); // { playerCount, playerColors, isVoidRuleEnabled }
  const [user, setUser] = useState(null);
  const [joinGameId, setJoinGameId] = useState(null);
  const [lastOnlineGameId, setLastOnlineGameId] = useState(null);

  const hasCachedGame = !!localStorage.getItem(GAME_STATE_KEY) && !!localStorage.getItem(PLAYER_COUNT_KEY);

  // Preload heavy assets (sounds and gifs) in the background so they are instantly ready during gameplay
  useEffect(() => {
    const audioFiles = [
      `${import.meta.env.BASE_URL}sounds/dice-roll.mp3`,
      `${import.meta.env.BASE_URL}sounds/capture.mp3`,
      `${import.meta.env.BASE_URL}sounds/goal.mp3`
    ];
    audioFiles.forEach(src => {
      const audio = new Audio();
      audio.src = src;
      audio.preload = 'auto';
    });

    const img = new Image();
    img.src = blehMochiGif;

    // Parse URL for joining online games
    const urlParams = new URLSearchParams(window.location.search);
    const joinId = urlParams.get('join');
    if (joinId) {
      setJoinGameId(joinId);
    }

    setLastOnlineGameId(localStorage.getItem(ONLINE_GAME_ID_KEY));

    const unsubscribe = onIdTokenChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          isAnonymous: currentUser.isAnonymous,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL
        });
      } else {
        setUser(null);
        // If no user is found in cache, sign in anonymously
        signInUserAnonymously();
      }
    });
    return () => unsubscribe();
  }, []);

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
    if (config.isOnline && config.gameId && !config.isPublic) {
      localStorage.setItem(ONLINE_GAME_ID_KEY, config.gameId);
      setLastOnlineGameId(config.gameId);
    }
    setGameConfig(config);
    setView('game');
  };

  const handleWipeAndGoToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    localStorage.removeItem(PLAYER_COUNT_KEY);
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.removeItem(ONLINE_GAME_ID_KEY);
    setGameConfig(null);
    setView('menu');
  };

  const handleReturnToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
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
            {/* Game Header */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-widest text-glow-gold text-gold">DYUT</h1>
            </div>
            {/* Minimalist Top-Right Action Menu */}
            <GameOverlay onShowRules={() => setView('rules')} onReturnToMenu={handleReturnToMenu} />
            <div className="flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 w-full z-10 relative pt-16 lg:pt-0 pb-8 lg:pb-0">
              <Board onGoToMenu={handleWipeAndGoToMenu} />
              <DiceTray />
            </div>
          </GameProvider>
        );
      case 'menu':
      default:
        return <UnifiedLobby 
          onStartGame={handleStartNewGame} 
          onResumeGame={handleResumeGame} 
          onShowRules={() => setView('rules')} 
          hasCachedGame={hasCachedGame} 
          joinGameId={joinGameId} 
          user={user} 
          lastOnlineGameId={lastOnlineGameId}
          onReconnectOnline={(id) => {
            setJoinGameId(id);
            window.history.pushState({}, '', `?join=${id}`);
          }}
        />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#3e3e3e] flex items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden outline-none">
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
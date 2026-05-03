import React, { useState, useEffect } from 'react';
import Board from './Board';
import DiceTray from './DiceTray';
import UnifiedLobby from './UnifiedLobby';
import RulesScreen from './RulesScreen';
import { GameProvider, useGame } from './GameContext';
import blehMochiGif from './assets/bleh-mochi.gif';
import { auth, signInUserAnonymously, checkAuthRedirect, initializeUserProfile } from './firebaseSetup.js';
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
      <button onClick={onShowRules} className="px-4 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-gold transition-colors font-sans text-xs font-bold uppercase tracking-widest" title="Rules">
        Rules
      </button>
      <button onClick={handleMenuClick} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-ruby transition-colors" title="Exit Game">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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

    let isMounted = true;

    const initializeAuth = async () => {
      // First, check for a redirect result. This needs to be awaited to prevent
      // the onIdTokenChanged listener from firing with a stale anonymous user first.
      const redirectedUser = await checkAuthRedirect();

      if (!isMounted) return;

      // If we get a user from the redirect, we can set it immediately.
      if (redirectedUser) {
        setUser({
          uid: redirectedUser.uid,
          isAnonymous: redirectedUser.isAnonymous,
          displayName: redirectedUser.displayName,
          photoURL: redirectedUser.photoURL
        });
      }

      // Now, set up the canonical listener for all subsequent auth changes.
      const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (!isMounted) return;

        if (currentUser) {
          if (!currentUser.isAnonymous) {
            await initializeUserProfile(currentUser);
          }
          
          setUser({
            uid: currentUser.uid,
            isAnonymous: currentUser.isAnonymous,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          });
        } else {
          // If there's no user and we didn't just come from a redirect, sign in anonymously.
          if (!redirectedUser) {
            signInUserAnonymously();
          }
          setUser(null);
        }
      });
      return unsubscribe;
    };

    let unsubFunc = null;
    initializeAuth().then(unsub => { unsubFunc = unsub; });
    
    return () => {
      isMounted = false;
      if (unsubFunc) unsubFunc();
    };
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
    if (config.isOnline && config.gameId) {
      if (!config.isPublic) {
        localStorage.setItem(ONLINE_GAME_ID_KEY, config.gameId);
        setLastOnlineGameId(config.gameId);
      } else {
        // Strip the URL so users don't accidentally auto-rejoin a public game on refresh
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    setGameConfig(config);
    setView('game');
  };

  const handleWipeAndGoToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    localStorage.removeItem(PLAYER_COUNT_KEY);
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.removeItem(ONLINE_GAME_ID_KEY);
    setJoinGameId(null);
    setGameConfig(null);
    setView('menu');
  };

  const handleReturnToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    setJoinGameId(null);
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
    <main className="min-h-screen w-full bg-[#3e3e3e] flex items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden outline-none">
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
    </main>
  )
}

export default App
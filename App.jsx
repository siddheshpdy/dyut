import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Board from './Board';
import DiceTray from './DiceTray';
import UnifiedLobby from './UnifiedLobby';
import RulesScreen from './RulesScreen';
import TutorialScreen from './TutorialScreen';
import HistoryScreen from './HistoryScreen';
import AboutScreen from './AboutScreen';
import { GameProvider, useGame } from './GameContext';
import blehMochiGif from './assets/bleh-mochi.gif';
import { auth, signInUserAnonymously, checkAuthRedirect, initializeUserProfile } from './firebaseSetup.js';
import { onIdTokenChanged } from 'firebase/auth';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';
const ONLINE_GAME_ID_KEY = 'dyut_last_online_id';

const GameOverlay = ({ onShowRules, onReturnToMenu, isMuted, toggleMute }) => {
  const { t } = useTranslation();
  const { state, leaveGame } = useGame();
  
  const handleMenuClick = () => {
    const msg = state.isPublic && state.isOnline
      ? t('leavePublicMatchConfirm', "Leave the match? You will be replaced by a bot and cannot rejoin.")
      : t('returnToMenuConfirm', "Return to main menu? Progress will be saved.");
    if (window.confirm(msg)) {
      if (state.isOnline && leaveGame) leaveGame();
      onReturnToMenu();
    }
  };

  return (
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-3 z-50">
      <button onClick={toggleMute} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-gold transition-colors" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ruby" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        )}
      </button>
      <button onClick={onShowRules} className="px-4 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-gold transition-colors font-sans text-xs font-bold uppercase tracking-widest" title={t('rules', 'Rules')}>
        {t('rules', 'Rules')}
      </button>
      <button onClick={handleMenuClick} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-ruby transition-colors" title={t('exitGame', 'Exit Game')}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
      </button>
    </div>
  );
};

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState('menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(null); // { playerCount, playerColors, isVoidRuleEnabled }
  const [user, setUser] = useState(null);
  const [joinGameId, setJoinGameId] = useState(null);
  const [lastOnlineGameId, setLastOnlineGameId] = useState(null);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dyut_muted') === 'true');

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('dyut_muted', next);
      window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: next }));
      return next;
    });
  };

  const hasCachedGame = !!localStorage.getItem(GAME_STATE_KEY) && !!localStorage.getItem(PLAYER_COUNT_KEY);

  // Preload heavy assets (sounds and gifs) in the background so they are instantly ready during gameplay
  useEffect(() => {
    // CrazyGames SDK: Loading Tracking
    if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
      try { window.CrazyGames.SDK.game.sdkGameLoadingStart(); } catch(e) {}
    }

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
    initializeAuth().then(unsub => { 
      unsubFunc = unsub; 
      if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
        try { window.CrazyGames.SDK.game.sdkGameLoadingStop(); } catch(e) {}
      }
    });
    
    const handleMuteChange = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handleMuteChange);

    return () => {
      isMounted = false;
      if (unsubFunc) unsubFunc();
      window.removeEventListener('dyut-mute-change', handleMuteChange);
    };
  }, []);

  // CrazyGames SDK: Gameplay Tracking
  useEffect(() => {
    if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
      try {
        if (view === 'game') {
          window.CrazyGames.SDK.game.gameplayStart();
        } else {
          window.CrazyGames.SDK.game.gameplayStop();
        }
      } catch (e) { console.error("CrazyGames event error:", e); }
    }
  }, [view]);

  const handleStartNewGame = (config) => {
    if (hasCachedGame) {
      if (window.confirm(t('wipeProgressConfirm', "A saved game exists. Starting a new game will wipe your progress. Are you sure?"))) {
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
      case 'history':
        return (
          <div className="relative z-10 w-full flex justify-center">
            <HistoryScreen onBack={() => setView('menu')} />
          </div>
        );
      case 'tutorial':
        return (
          <div className="relative z-10 w-full flex justify-center">
            <TutorialScreen onBack={() => setView('menu')} />
          </div>
        );
      case 'about':
        return (
          <div className="relative z-10 w-full flex justify-center">
            <AboutScreen onBack={() => setView('menu')} />
          </div>
        );
      case 'game':
        return (
          <GameProvider gameConfig={gameConfig}>
            {/* Game Header */}
            <div className="absolute top-5 sm:top-6 left-4 sm:left-1/2 translate-x-0 sm:-translate-x-1/2 z-50 pointer-events-none">
              <h1 className="dyut-title text-2xl sm:text-4xl font-bold tracking-widest text-glow-gold text-[var(--color-gold)]">DYUT</h1>
            </div>
            {/* Minimalist Top-Right Action Menu */}
            <GameOverlay onShowRules={() => setView('rules')} onReturnToMenu={handleReturnToMenu} isMuted={isMuted} toggleMute={toggleMute} />
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
          onShowTutorial={() => setView('tutorial')}
          onShowHistory={() => setView('history')}
          onShowAbout={() => setView('about')}
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
    <main className="min-h-screen w-full bg-[var(--color-charcoal)] flex items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden outline-none font-sans">
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
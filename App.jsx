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
import { DYUT_ICONS } from './dyut-icons';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';
const ONLINE_GAME_ID_KEY = 'dyut_last_online_id';
const CRAZYGAMES_ADS_ENABLED = import.meta.env.VITE_CG_ENABLE_ADS === 'true';
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const sync = (event) => setIsDesktop(event.matches);
    setIsDesktop(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isDesktop;
};

const GameOverlay = ({ onShowRules, onShowTutorial, onShowHistory, onShowAbout, onReturnToMenu, isMuted, toggleMute }) => {
  const { t } = useTranslation();
  const { state, leaveGame } = useGame();
  const ExitIcon = DYUT_ICONS.exit;
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;
  const HowToPlayIcon = DYUT_ICONS.howToPlay;
  const RulesIcon = DYUT_ICONS.rules;
  const HistoryIcon = DYUT_ICONS.history;
  const AboutIcon = DYUT_ICONS.inviteFriend;
  const TimerIcon = DYUT_ICONS.timerAlt;
  const ScoreIcon = DYUT_ICONS.score;
  const activeScore = state.players?.[state.currentPlayer]?.pieces?.filter(pos => pos === 999).length || 0;
  
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
    <>
    <div className="absolute left-3 right-3 top-3 z-50 flex items-center justify-between rounded-xl border border-gold/30 bg-black/55 px-3 py-2 shadow-[0_0_24px_rgba(0,0,0,0.65)] backdrop-blur-md lg:hidden">
      <div>
        <div className="dyut-title text-2xl font-bold leading-none tracking-widest text-gold text-glow-gold">DYUT</div>
        <div className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-gold/80">{t('gameOfLegends', 'The Game of Legends')}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggleMute} className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-black/35 text-white/75 transition-colors hover:text-gold" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
          <SoundIcon className={`h-5 w-5 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
        </button>
        <button onClick={onShowRules} className="h-10 rounded-full border border-gold/30 bg-black/35 px-4 text-xs font-bold uppercase tracking-widest text-white/75 transition-colors hover:text-gold">
          {t('rules', 'Rules')}
        </button>
        <button onClick={handleMenuClick} className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-black/35 text-white/75 transition-colors hover:text-ruby" title={t('exitGame', 'Exit Game')}>
          <ExitIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div className="absolute left-4 right-4 top-4 z-50 hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 rounded-[22px] border border-gold/45 bg-[#050403]/75 px-5 py-2.5 shadow-[0_0_34px_rgba(0,0,0,0.76),inset_0_0_36px_rgba(234,179,8,0.07)] backdrop-blur-md lg:grid xl:px-9">
      <nav className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 justify-self-start text-white/80 xl:gap-x-7">
        <button onClick={onShowTutorial} className="group flex items-center gap-2 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><HowToPlayIcon className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-sm xl:text-lg">{t('howToPlay', 'How to Play')}</span></button>
        <button onClick={onShowRules} className="group flex items-center gap-2 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><RulesIcon className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-sm xl:text-lg">{t('rules', 'Rules')}</span></button>
        <button onClick={onShowHistory} className="group flex items-center gap-2 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><HistoryIcon className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-sm xl:text-lg">{t('history', 'History')}</span></button>
        <button onClick={onShowAbout} className="group flex items-center gap-2 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><AboutIcon className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-sm xl:text-lg">{t('aboutUs', 'About Us')}</span></button>
      </nav>

      <div className="flex flex-col items-center justify-self-center">
        <div className="flex items-center gap-3 xl:gap-4">
          <span className="h-px w-10 bg-gradient-to-r from-transparent via-gold/70 to-gold xl:w-16"></span>
          <h1 className="dyut-title text-4xl font-bold leading-none tracking-[0.16em] text-gold text-glow-gold xl:text-6xl">DYUT</h1>
          <span className="h-px w-10 bg-gradient-to-l from-transparent via-gold/70 to-gold xl:w-16"></span>
        </div>
        <span className="-mt-1 font-display text-[10px] font-bold uppercase tracking-[0.24em] text-gold xl:text-xs xl:tracking-[0.28em]">{t('gameOfLegends', 'The Game of Legends')}</span>
      </div>

      <div className="flex items-center justify-end gap-3 justify-self-end xl:gap-5">
        <div className="flex overflow-hidden rounded-xl border border-gold/35 bg-black/45 shadow-[inset_0_0_18px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-2 px-3 py-2 xl:gap-3 xl:px-5 xl:py-2.5">
            <TimerIcon className="h-6 w-6 text-gold xl:h-7 xl:w-7" aria-hidden="true" />
            <div className="text-center">
              <div className="font-display text-xl leading-none text-white/90 xl:text-2xl">--:--</div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/70 xl:text-[10px]">{t('turnTimer', 'Turn Timer')}</div>
            </div>
          </div>
          <div className="w-px bg-gold/25"></div>
          <div className="flex items-center gap-2 px-3 py-2 xl:gap-3 xl:px-5 xl:py-2.5">
            <ScoreIcon className="h-6 w-6 text-gold xl:h-7 xl:w-7" aria-hidden="true" />
            <div className="text-center">
              <div className="font-display text-xl leading-none text-white/90 xl:text-2xl">{activeScore}</div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/70 xl:text-[10px]">{t('score', 'Score')}</div>
            </div>
          </div>
        </div>
        <button onClick={toggleMute} className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/35 bg-black/45 text-white/75 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] transition-colors hover:text-gold xl:h-14 xl:w-14" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
          <SoundIcon className={`h-6 w-6 xl:h-7 xl:w-7 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
        </button>
        <button onClick={handleMenuClick} className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/35 bg-black/45 text-white/75 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] transition-colors hover:text-ruby xl:h-14 xl:w-14" title={t('exitGame', 'Exit Game')}>
          <ExitIcon className="h-6 w-6 xl:h-7 xl:w-7" aria-hidden="true" />
        </button>
      </div>
    </div>
    </>
  );
};

const GameInfoOverlay = ({ infoView, onClose }) => {
  const CloseIcon = DYUT_ICONS.close;

  const content = {
    rules: <RulesScreen onBack={onClose} />,
    history: <HistoryScreen onBack={onClose} />,
    tutorial: <TutorialScreen onBack={onClose} />,
    about: <AboutScreen onBack={onClose} />,
  }[infoView];

  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/78 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 z-[130] flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-black/70 text-white/75 shadow-[0_0_20px_rgba(0,0,0,0.65)] transition-colors hover:text-gold"
        aria-label="Close"
      >
        <CloseIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="relative z-[125] flex min-h-full w-full items-center justify-center py-10">
        {content}
      </div>
    </div>
  );
};

function App() {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const [view, setView] = useState('menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(null); // { playerCount, playerColors, isVoidRuleEnabled }
  const [user, setUser] = useState(null);
  const [joinGameId, setJoinGameId] = useState(null);
  const [lastOnlineGameId, setLastOnlineGameId] = useState(null);
  const [gameInfoView, setGameInfoView] = useState(null);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dyut_muted') === 'true');
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;

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
    let joinId = urlParams.get('join') || urlParams.get('roomId');
    
    // Fallback for portals that inject parameters into the hash fragment
    if (!joinId && window.location.hash.includes('?')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(window.location.hash.indexOf('?')));
      joinId = hashParams.get('join') || hashParams.get('roomId');
    }

    if (joinId) {
      setJoinGameId(joinId);
    }

    setLastOnlineGameId(localStorage.getItem(ONLINE_GAME_ID_KEY));

    let isMounted = true;
    let cgJoinListener = null;

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
      if (import.meta.env.VITE_IS_PORTAL) {
        const setupCrazyGames = async () => {
          try {
            if (window.cgInitPromise) await window.cgInitPromise;
            if (!isMounted) return;
            
            window.CrazyGames.SDK.game.loadingStop();
            
            // 1. Check for boot-time invites via inviteParams property
            try {
              const inviteParams = window.CrazyGames.SDK.game.inviteParams;
              if (inviteParams && inviteParams.roomId) {
                setJoinGameId(inviteParams.roomId);
              }
            } catch (e) { console.warn("CrazyGames inviteParams error:", e); }

            cgJoinListener = (inviteParams) => {
              if (inviteParams && inviteParams.roomId) {
                setView('menu'); // Force route to lobby if they are in a match/tutorial
                setJoinGameId(inviteParams.roomId);
              }
            };
            window.CrazyGames.SDK.game.addJoinRoomListener(cgJoinListener);
          } catch (e) {
            console.error("CrazyGames SDK setup failed:", e);
          }
        };
        setupCrazyGames();
      }
    });
    
    const handleMuteChange = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handleMuteChange);

    return () => {
      isMounted = false;
      if (unsubFunc) unsubFunc();
      window.removeEventListener('dyut-mute-change', handleMuteChange);
      if (cgJoinListener && window.CrazyGames?.SDK) {
        try { window.CrazyGames.SDK.game.removeJoinRoomListener(cgJoinListener); } catch (e) {}
      }
    };
  }, []);

  // Centralized function to call midgame ads and handle audio muting
  const triggerMidgameAd = () => {
    if (import.meta.env.VITE_IS_PORTAL && CRAZYGAMES_ADS_ENABLED && window.CrazyGames?.SDK) {
      // Save the user's current mute preference before the ad forces a mute
      const wasMuted = localStorage.getItem('dyut_muted') === 'true';

      const callbacks = {
        adStarted: () => {
          window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: true }));
        },
        adFinished: () => {
          window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: wasMuted }));
        },
        adError: () => {
          window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: wasMuted }));
        },
      };
      window.CrazyGames.SDK.ad.requestAd('midgame', callbacks);
    }
  };

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
    setGameInfoView(null);
    setView('game');
  };

  const handleWipeAndGoToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    localStorage.removeItem(PLAYER_COUNT_KEY);
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.removeItem(ONLINE_GAME_ID_KEY);
    setJoinGameId(null);
    setGameConfig(null);
    setGameInfoView(null);
    setView('menu');
    triggerMidgameAd();
    if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
      try { window.CrazyGames.SDK.game.leftRoom(); } catch (e) {}
    }
  };

  const handleReturnToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    setJoinGameId(null);
    setGameConfig(null);
    setGameInfoView(null);
    setView('menu');
    triggerMidgameAd();
    if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
      try { window.CrazyGames.SDK.game.leftRoom(); } catch (e) {}
    }
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
            <div className="absolute inset-0 overflow-hidden bg-[#060504]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(80,38,16,0.34),transparent_42%),linear-gradient(90deg,rgba(0,0,0,0.96),rgba(10,8,6,0.58)_24%,rgba(10,8,6,0.58)_76%,rgba(0,0,0,0.96))]"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(234,179,8,0.08),transparent_30%),radial-gradient(circle_at_50%_50%,transparent_0,rgba(0,0,0,0.2)_45%,rgba(0,0,0,0.78)_100%)]"></div>
            </div>
            <GameOverlay
              onShowRules={() => setGameInfoView('rules')}
              onShowTutorial={() => setGameInfoView('tutorial')}
              onShowHistory={() => setGameInfoView('history')}
              onShowAbout={() => setGameInfoView('about')}
              onReturnToMenu={handleReturnToMenu}
              isMuted={isMuted}
              toggleMute={toggleMute}
            />
            {isDesktop ? (
              <div className="relative z-10 flex h-[100dvh] w-full flex-row items-center justify-center gap-10 overflow-hidden px-10 pb-6 pt-28 xl:gap-12">
                <Board onGoToMenu={handleWipeAndGoToMenu} layoutMode="desktop" />
                <DiceTray layoutMode="desktop" />
              </div>
            ) : (
              <div className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden px-2 pb-[19rem] pt-16 sm:px-3 sm:pb-[20rem]">
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <Board onGoToMenu={handleWipeAndGoToMenu} layoutMode="mobile" />
                </div>
                <div className="absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3">
                  <DiceTray layoutMode="mobile" />
                </div>
              </div>
            )}
            <GameInfoOverlay infoView={gameInfoView} onClose={() => setGameInfoView(null)} />
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
    <main className={`min-h-[100dvh] w-full bg-[var(--color-charcoal)] flex items-center justify-center relative overflow-x-hidden outline-none font-sans ${view === 'menu' || view === 'game' ? 'p-0 overflow-hidden' : 'p-4 overflow-y-auto'}`}>
      {view !== 'menu' && view !== 'game' && (
        <button onClick={toggleMute} className="absolute top-4 left-4 sm:top-6 sm:left-6 w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/70 hover:text-gold transition-colors z-[100]" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
          <SoundIcon className={`h-5 w-5 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
        </button>
      )}
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

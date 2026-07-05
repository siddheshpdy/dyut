import React, { useState, useEffect, useRef } from 'react';
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
import { auth, signInUserAnonymously, checkAuthRedirect, initializeUserProfile, loadAccountResumeGame, saveAccountResumeGame } from './firebaseSetup.js';
import { onIdTokenChanged } from 'firebase/auth';
import { DYUT_ICONS } from './dyut-icons';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';
const ONLINE_GAME_ID_KEY = 'dyut_last_online_id';
const CRAZYGAMES_STATS_KEY = 'dyut_stats';
const IS_PORTAL = import.meta.env.VITE_IS_PORTAL === 'true';
const CRAZYGAMES_ADS_ENABLED = import.meta.env.VITE_CG_ENABLE_ADS === 'true';
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
const SHORT_MOBILE_HEIGHT_MEDIA_QUERY = '(max-height: 740px)';
const MOBILE_HEADER_RESERVED_SPACE = 'clamp(4.5rem, 10.5vh, 5.35rem)';
const MOBILE_HEADER_RESERVED_SPACE_SHORT = '4.15rem';
const MOBILE_TRAY_RESERVED_SPACE = 'clamp(13.5rem, 24.5vh, 15rem)';
const MOBILE_TRAY_RESERVED_SPACE_SHORT = '12.2rem';
const hasOfflineResumeCache = () => !!localStorage.getItem(GAME_STATE_KEY) && !!localStorage.getItem(PLAYER_COUNT_KEY);

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

const useIsShortMobileHeight = () => {
  const [isShortMobileHeight, setIsShortMobileHeight] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(SHORT_MOBILE_HEIGHT_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(SHORT_MOBILE_HEIGHT_MEDIA_QUERY);
    const sync = (event) => setIsShortMobileHeight(event.matches);
    setIsShortMobileHeight(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isShortMobileHeight;
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
    <div className="absolute left-2.5 right-2.5 top-2.5 z-50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-xl border border-gold/30 bg-black/55 px-3 py-1.5 shadow-[0_0_24px_rgba(0,0,0,0.65)] backdrop-blur-md lg:hidden">
      <div>
        <div className="dyut-title text-[1.7rem] font-bold leading-none tracking-[0.18em] text-gold text-glow-gold">DYUT</div>
        <div className="font-display text-[8px] font-bold uppercase tracking-[0.18em] text-gold/80">{t('gameOfLegends', 'The Game of Legends')}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={toggleMute} className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-black/35 text-white/75 transition-colors hover:text-gold" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
          <SoundIcon className={`h-4.5 w-4.5 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
        </button>
        <button onClick={onShowRules} className="h-9 rounded-full border border-gold/30 bg-black/35 px-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75 transition-colors hover:text-gold">
          {t('rules', 'Rules')}
        </button>
        <button onClick={handleMenuClick} className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-black/35 text-white/75 transition-colors hover:text-ruby" title={t('exitGame', 'Exit Game')}>
          <ExitIcon className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div className="absolute left-4 right-4 top-4 z-50 hidden grid-cols-[minmax(0,0.95fr)_auto_minmax(0,0.82fr)] items-center gap-3 rounded-[22px] border border-gold/45 bg-[#050403]/75 px-4 py-1 shadow-[0_0_34px_rgba(0,0,0,0.76),inset_0_0_36px_rgba(234,179,8,0.07)] backdrop-blur-md lg:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-4 xl:px-9 xl:py-1.5">
      <nav className="flex min-w-0 flex-nowrap items-center gap-3 justify-self-start text-white/80 xl:gap-x-7">
        <button onClick={onShowTutorial} className="group flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><HowToPlayIcon className="h-4.5 w-4.5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-[0.92rem] xl:text-lg">{t('howToPlay', 'How to Play')}</span></button>
        <button onClick={onShowRules} className="group flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><RulesIcon className="h-4.5 w-4.5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-[0.92rem] xl:text-lg">{t('rules', 'Rules')}</span></button>
        <button onClick={onShowHistory} className="group flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><HistoryIcon className="h-4.5 w-4.5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-[0.92rem] xl:text-lg">{t('history', 'History')}</span></button>
        <button onClick={onShowAbout} className="group flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-gold xl:gap-3"><AboutIcon className="h-4.5 w-4.5 shrink-0 text-gold transition-transform group-hover:-translate-y-0.5 xl:h-6 xl:w-6" aria-hidden="true" /><span className="font-display text-[0.92rem] xl:text-lg">{t('aboutUs', 'About Us')}</span></button>
      </nav>

      <div className="flex flex-col items-center justify-self-center">
        <div className="flex items-center gap-2 xl:gap-4">
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-gold/70 to-gold xl:w-16"></span>
          <h1 className="dyut-title text-[2.6rem] font-bold leading-none tracking-[0.14em] text-gold text-glow-gold xl:text-6xl">DYUT</h1>
          <span className="h-px w-8 bg-gradient-to-l from-transparent via-gold/70 to-gold xl:w-16"></span>
        </div>
        <span className="-mt-1 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-gold xl:text-xs xl:tracking-[0.28em]">{t('gameOfLegends', 'The Game of Legends')}</span>
      </div>

      <div className="flex items-center justify-end gap-2.5 justify-self-end xl:gap-5">
        <div className="flex overflow-hidden rounded-xl border border-gold/35 bg-black/45 shadow-[inset_0_0_18px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-2 px-2.5 py-1 xl:gap-3 xl:px-5 xl:py-2">
            <ScoreIcon className="h-5.5 w-5.5 text-gold xl:h-7 xl:w-7" aria-hidden="true" />
            <div className="text-center">
              <div className="font-display text-lg leading-none text-white/90 xl:text-2xl">{activeScore}</div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/70 xl:text-[10px]">{t('score', 'Score')}</div>
            </div>
          </div>
        </div>
        <button onClick={toggleMute} className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/35 bg-black/45 text-white/75 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] transition-colors hover:text-gold xl:h-14 xl:w-14" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
          <SoundIcon className={`h-5.5 w-5.5 xl:h-7 xl:w-7 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
        </button>
        <button onClick={handleMenuClick} className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/35 bg-black/45 text-white/75 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] transition-colors hover:text-ruby xl:h-14 xl:w-14" title={t('exitGame', 'Exit Game')}>
          <ExitIcon className="h-5.5 w-5.5 xl:h-7 xl:w-7" aria-hidden="true" />
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
  const isShortMobileHeight = useIsShortMobileHeight();
  const [view, setView] = useState('menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(null); // { playerCount, playerColors, isVoidRuleEnabled }
  const [user, setUser] = useState(null);
  const [joinGameId, setJoinGameId] = useState(null);
  const [hasCachedGame, setHasCachedGame] = useState(() => hasOfflineResumeCache());
  const [deviceOnlineGameId, setDeviceOnlineGameId] = useState(() => localStorage.getItem(ONLINE_GAME_ID_KEY));
  const [accountOnlineGameId, setAccountOnlineGameId] = useState(null);
  const [gameSessionKey, setGameSessionKey] = useState(0);
  const [gameInfoView, setGameInfoView] = useState(null);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dyut_muted') === 'true');
  const [portalAutoStartPending, setPortalAutoStartPending] = useState(false);
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;
  const mobileHeaderReservedSpace = isShortMobileHeight ? MOBILE_HEADER_RESERVED_SPACE_SHORT : MOBILE_HEADER_RESERVED_SPACE;
  const mobileTrayReservedSpace = isShortMobileHeight ? MOBILE_TRAY_RESERVED_SPACE_SHORT : MOBILE_TRAY_RESERVED_SPACE;
  const mobileBoardSize = `min(calc(96vw - 0.75rem), calc(100dvh - ${mobileHeaderReservedSpace} - ${mobileTrayReservedSpace} - env(safe-area-inset-bottom) - ${isShortMobileHeight ? '0.65rem' : '1.25rem'}))`;
  const viewRef = useRef(view);
  const joinGameIdRef = useRef(joinGameId);
  const portalAutoStartQueuedRef = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    joinGameIdRef.current = joinGameId;
  }, [joinGameId]);

  useEffect(() => {
    if (view !== 'menu') return;

    setHasCachedGame(hasOfflineResumeCache());
    setDeviceOnlineGameId(localStorage.getItem(ONLINE_GAME_ID_KEY));
  }, [view]);

  useEffect(() => {
    if (IS_PORTAL) return undefined;

    let isMounted = true;
    const syncAccountResume = async () => {
      if (!user || user.isAnonymous) {
        if (isMounted) setAccountOnlineGameId(null);
        return;
      }

      const savedResume = await loadAccountResumeGame();
      if (isMounted) {
        setAccountOnlineGameId(savedResume?.gameId || null);
      }
    };

    syncAccountResume();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.isAnonymous]);

  const clearOfflineResumeCache = () => {
    localStorage.removeItem(PLAYER_COUNT_KEY);
    localStorage.removeItem(GAME_STATE_KEY);
    setHasCachedGame(false);
  };

  const handleReconnectOnline = (id) => {
    if (!id) return;
    setJoinGameId(id);
    window.history.pushState({}, '', `?join=${id}`);
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('dyut_muted', next);
      window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: next }));
      return next;
    });
  };

  const resumeOnlineGameId = accountOnlineGameId || deviceOnlineGameId;

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
      joinGameIdRef.current = joinId;
      setJoinGameId(joinId);
    }

    let isMounted = true;
    let cgJoinListener = null;
    let cgAuthListener = null;

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
      if (IS_PORTAL) {
        const setupCrazyGames = async () => {
          try {
            if (window.cgInitPromise) await window.cgInitPromise;
            if (!isMounted) return;
            
            window.CrazyGames.SDK.game.loadingStop();
            const maybeQueuePortalFirstSession = async () => {
              if (
                !isMounted ||
                portalAutoStartQueuedRef.current ||
                viewRef.current !== 'menu' ||
                joinGameIdRef.current ||
                localStorage.getItem(GAME_STATE_KEY) ||
                localStorage.getItem(PLAYER_COUNT_KEY)
              ) {
                return;
              }

              try {
                if (!window.CrazyGames.SDK.user.isUserAccountAvailable) return;

                const systemUser = await window.CrazyGames.SDK.user.getUser();
                if (!systemUser || portalAutoStartQueuedRef.current) return;

                let stats = await window.CrazyGames.SDK.data.getItem(CRAZYGAMES_STATS_KEY);
                if (typeof stats === 'string') stats = JSON.parse(stats);
                if (stats) return;

                portalAutoStartQueuedRef.current = true;
                await window.CrazyGames.SDK.data.setItem(CRAZYGAMES_STATS_KEY, {
                  gamesPlayed: 0,
                  wins: 0,
                  hasSeenPortalIntro: true
                });

                if (
                  isMounted &&
                  viewRef.current === 'menu' &&
                  !joinGameIdRef.current &&
                  !localStorage.getItem(GAME_STATE_KEY) &&
                  !localStorage.getItem(PLAYER_COUNT_KEY)
                ) {
                  setPortalAutoStartPending(true);
                }
              } catch (e) {
                console.error("CrazyGames first-session check failed:", e);
              }
            };
            
            // 1. Check for boot-time invites via inviteParams property
            try {
              const inviteParams = window.CrazyGames.SDK.game.inviteParams;
              if (inviteParams && inviteParams.roomId) {
                joinGameIdRef.current = inviteParams.roomId;
                setJoinGameId(inviteParams.roomId);
              }
            } catch (e) { console.warn("CrazyGames inviteParams error:", e); }

            await maybeQueuePortalFirstSession();

            cgJoinListener = (inviteParams) => {
              if (inviteParams && inviteParams.roomId) {
                setView('menu'); // Force route to lobby if they are in a match/tutorial
                joinGameIdRef.current = inviteParams.roomId;
                setJoinGameId(inviteParams.roomId);
              }
            };
            window.CrazyGames.SDK.game.addJoinRoomListener(cgJoinListener);

            if (window.CrazyGames.SDK.user?.addAuthListener) {
              cgAuthListener = (systemUser) => {
                if (systemUser) {
                  maybeQueuePortalFirstSession();
                }
              };
              window.CrazyGames.SDK.user.addAuthListener(cgAuthListener);
            }
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
      if (cgAuthListener && window.CrazyGames?.SDK?.user?.removeAuthListener) {
        try { window.CrazyGames.SDK.user.removeAuthListener(cgAuthListener); } catch (e) {}
      }
    };
  }, []);

  // Centralized function to call midgame ads and handle audio muting
  const triggerMidgameAd = () => {
    if (IS_PORTAL && CRAZYGAMES_ADS_ENABLED && window.CrazyGames?.SDK) {
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
    handleGameSetupComplete(config);
  };

  const handleResumeGame = () => {
    const savedCount = localStorage.getItem(PLAYER_COUNT_KEY);
    // We don't need to load the full config, just enough for the provider to work.
    // The provider itself will load the full state from storage.
    setGameConfig({ playerCount: parseInt(savedCount, 10) });
    setGameSessionKey(prev => prev + 1);
    setView('game');
  };

  const handleGameSetupComplete = (config) => {
    setPortalAutoStartPending(false);
    if (!config.isOnline) {
      localStorage.removeItem(GAME_STATE_KEY);
      localStorage.setItem(PLAYER_COUNT_KEY, config.playerCount);
      setHasCachedGame(true);
    }

    if (config.isOnline && config.gameId) {
      if (!config.isPublic) {
        localStorage.setItem(ONLINE_GAME_ID_KEY, config.gameId);
        setDeviceOnlineGameId(config.gameId);
        if (!IS_PORTAL && user && !user.isAnonymous) {
          saveAccountResumeGame({
            gameId: config.gameId,
            savedAt: Date.now()
          }).then(() => setAccountOnlineGameId(config.gameId));
        }
      } else {
        // Strip the URL so users don't accidentally auto-rejoin a public game on refresh
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    setGameConfig(config);
    setGameSessionKey(prev => prev + 1);
    setGameInfoView(null);
    setView('game');
  };

  const handleWipeAndGoToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    if (gameConfig?.isOnline && gameConfig?.isPublic) {
      localStorage.removeItem(ONLINE_GAME_ID_KEY);
      setDeviceOnlineGameId(null);
    } else if (!gameConfig?.isOnline) {
      clearOfflineResumeCache();
    }
    setJoinGameId(null);
    setGameConfig(null);
    setGameInfoView(null);
    setView('menu');
    triggerMidgameAd();
    if (IS_PORTAL && window.CrazyGames?.SDK) {
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
    if (IS_PORTAL && window.CrazyGames?.SDK) {
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
          <GameProvider
            key={`${gameSessionKey}:${gameConfig?.isOnline ? 'online' : 'offline'}:${gameConfig?.gameId || 'local'}:${gameConfig?.playerCount || 0}`}
            gameConfig={gameConfig}
          >
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
              <div className="relative z-10 flex h-[100dvh] w-full flex-row items-start justify-center gap-8 overflow-hidden px-8 pb-4 pt-[7.4rem] xl:gap-10 xl:px-10 xl:pt-[7.75rem]">
                <Board onGoToMenu={handleWipeAndGoToMenu} layoutMode="desktop" />
                <DiceTray layoutMode="desktop" />
              </div>
            ) : (
              <div className={`relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 ${isShortMobileHeight ? 'pt-[4.15rem]' : 'pt-[clamp(4.5rem,10.5vh,5.35rem)]'}`}>
                <div className={`flex min-h-0 flex-1 items-center overflow-hidden ${isShortMobileHeight ? 'justify-start pt-0.5 pb-1' : 'justify-center pt-2 pb-2 [@media(min-height:780px)]:justify-end [@media(min-height:780px)]:pb-3 [@media(min-height:900px)]:pb-4'}`}>
                  <div style={{ width: mobileBoardSize, height: mobileBoardSize }}>
                    <Board onGoToMenu={handleWipeAndGoToMenu} layoutMode="mobile" />
                  </div>
                </div>
                <div className="z-20 px-0 pt-1.5">
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
          resumeOnlineGameId={resumeOnlineGameId}
          joinGameId={joinGameId} 
          user={user} 
          autoStartPortalIntro={IS_PORTAL && portalAutoStartPending}
          onPortalAutoStartConsumed={() => setPortalAutoStartPending(false)}
          onReconnectOnline={handleReconnectOnline}
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

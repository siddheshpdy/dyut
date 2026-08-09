import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Board from './Board';
import DiceTray from './DiceTray';
import UnifiedLobby, { EconomySummary } from './UnifiedLobby';
import RulesScreen from './RulesScreen';
import TutorialScreen from './TutorialScreen';
import HistoryScreen from './HistoryScreen';
import AboutScreen from './AboutScreen';
import VictoryScreen from './VictoryScreen';
import { GameProvider, useGame, canLocalClientAct, getActiveTurnPlayerId, isGameOverState } from './GameContext';
import { canSpawnPiece, hasAnyPlayableMove } from './gameLogic';
import blehMochiGif from './assets/bleh-mochi.gif';
import { auth, signInUserAnonymously, checkAuthRedirect, initializeUserProfile, loadAccountResumeGame, saveAccountResumeGame } from './firebaseSetup.js';
import { onIdTokenChanged } from 'firebase/auth';
import { DYUT_ICONS } from './dyut-icons';
import { bindCrazyGamesMuteSetting, getEffectiveMuteState, toggleUserMutePreference } from './audio';
import { clearCrazyGamesOfflineResume, loadCrazyGamesOfflineResumeToLocal } from './crazyGamesStorage';
import { parseCrazyGamesStoredValue, serializeCrazyGamesStoredValue } from './crazyGamesData';
import { EconomyProvider } from './EconomyContext';

const PLAYER_COUNT_KEY = 'dyut_player_count';
const GAME_STATE_KEY = 'dyut_game_state';
const ONLINE_GAME_ID_KEY = 'dyut_last_online_id';
const FIRST_GAME_HELP_KEY = 'dyut_has_seen_in_game_how_to_play';
const CRAZYGAMES_STATS_KEY = 'dyut_stats';
const IS_PORTAL = import.meta.env.VITE_CRAZYGAMES_BUILD === 'true';
// Medium/tablet viewports use the mobile holder and queue layout so no player
// base or queue content is clipped. The full desktop tray remains desktop-only.
const DESKTOP_MEDIA_QUERY = '(min-width: 1200px)';
const SHORT_MOBILE_HEIGHT_MEDIA_QUERY = '(max-height: 740px)';
const COMPACT_LANDSCAPE_MEDIA_QUERY = '(orientation: landscape) and (min-width: 760px) and (max-height: 740px)';
const MOBILE_HEADER_RESERVED_SPACE = 'clamp(3.8rem, 8.5vh, 4.3rem)';
const MOBILE_HEADER_RESERVED_SPACE_SHORT = '3.65rem';
const MOBILE_TRAY_RESERVED_SPACE = 'clamp(13.5rem, 24.5vh, 15rem)';
const MOBILE_TRAY_RESERVED_SPACE_SHORT = '12.2rem';
const getQaPreviewScreen = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('qa');
};
const getQaCaptureScenarioConfig = (screen) => {
  if (screen !== 'scenario' && screen !== 'long-name') return null;
  const playerOneName = screen === 'long-name'
    ? 'A Very Long CrazyGames Player Name That Must Be Truncated'
    : 'Capture Hero';

  return {
    playerCount: 4,
    activeSeats: ['Player1', 'Player2', 'Player3', 'Player4'],
    playerColors: ['ruby', 'sapphire', 'emerald', 'amber'],
    playerAliases: { Player1: playerOneName, Player2: 'Bot 2', Player3: 'Bot 3', Player4: 'Bot 4' },
    bots: ['Player1', 'Player2', 'Player3', 'Player4'],
    initialStateOverride: {
      currentPlayer: 'Player1',
      hasRolledThisTurn: true,
      rollingPhaseComplete: true,
      turnQueue: [{ d1: 4, d2: null, sum: 4 }],
      scriptedRolls: [
        { d1: 6, d2: 6 }, { d1: 4, d2: 6 }, { d1: 4, d2: 4 }, { d1: 3, d2: 6 },
        { d1: 1, d2: 4 }, { d1: 3, d2: 3 }, { d1: 6, d2: 4 }, { d1: 6, d2: 6 },
        { d1: 4, d2: 3 }, { d1: 1, d2: 6 }, { d1: 4, d2: 4 }, { d1: 6, d2: 3 },
      ],
      players: {
        Player1: { color: 'ruby', name: playerOneName, hasKilled: false, pieces: [10, 8, -1, -1], team: 0 },
        Player2: { color: 'sapphire', name: 'Rival', hasKilled: false, pieces: [65, -1, -1, -1], team: 0 },
        Player3: { color: 'emerald', name: 'Shield Pair', hasKilled: false, pieces: [20, 20, -1, -1], team: 0 },
        Player4: { color: 'amber', name: 'Bot 4', hasKilled: false, pieces: [18, -1, -1, -1], team: 0 },
      },
    },
  };
};
const hasOfflineResumeCache = () => !!localStorage.getItem(GAME_STATE_KEY) && !!localStorage.getItem(PLAYER_COUNT_KEY);
const shouldShowFirstGameHelp = () => {
  try {
    if (localStorage.getItem(FIRST_GAME_HELP_KEY) === 'true') return false;
    localStorage.setItem(FIRST_GAME_HELP_KEY, 'true');
    return true;
  } catch (error) {
    return false;
  }
};

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

const useIsCompactLandscape = () => {
  const [isCompactLandscape, setIsCompactLandscape] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY);
    const sync = (event) => setIsCompactLandscape(event.matches);
    setIsCompactLandscape(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isCompactLandscape;
};

const GameOverlay = ({ onShowRules, onShowTutorial, onShowHistory, onShowAbout, onReturnToMenu, isMuted, toggleMute, user }) => {
  const { t } = useTranslation();
  const { state, leaveGame } = useGame();
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const ExitIcon = DYUT_ICONS.exit;
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;
  const HowToPlayIcon = DYUT_ICONS.howToPlay;
  const RulesIcon = DYUT_ICONS.rules;
  const HistoryIcon = DYUT_ICONS.history;
  const AboutIcon = DYUT_ICONS.inviteFriend;
  const ScoreIcon = DYUT_ICONS.score;
  const ProfileIcon = DYUT_ICONS.profileFallback;
  const MenuIcon = DYUT_ICONS.menu;
  const CloseIcon = DYUT_ICONS.close;
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
      <header className="absolute inset-x-0 top-0 z-[80] flex h-[3.75rem] items-center border-b border-gold/35 bg-[#0b0c0c]/95 px-4 shadow-[0_5px_20px_rgba(0,0,0,0.3)] backdrop-blur-md sm:px-5 min-[1200px]:h-[4.25rem] min-[1200px]:px-8">
        <button type="button" onClick={() => setIsGameMenuOpen((open) => !open)} aria-expanded={isGameMenuOpen} aria-controls="game-navigation-pane" aria-label={isGameMenuOpen ? t('closeMenu', 'Close menu') : t('openMenu', 'Open menu')} className="flex h-9 w-9 shrink-0 items-center justify-center text-gold transition-colors hover:text-[#ffe17b] min-[1200px]:h-10 min-[1200px]:w-10">
          {isGameMenuOpen ? <CloseIcon className="h-5 w-5" aria-hidden="true" /> : <MenuIcon className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />}
        </button>

        <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center">
          <h1 className="dyut-title font-display text-[1.2rem] font-bold leading-none tracking-[0.12em] text-gold text-glow-gold max-[399px]:text-[1.05rem] sm:text-[1.9rem] sm:tracking-[0.17em] min-[1200px]:text-[2.25rem]">DYUT</h1>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 min-[1200px]:gap-7 min-[1500px]:gap-10">
          <div className="hidden items-center gap-2 text-white/90 min-[700px]:flex min-[1200px]:min-w-[7.25rem] min-[1200px]:justify-center" title={t('score', 'Score')}>
            <ScoreIcon className="h-5 w-5 text-gold min-[1200px]:h-6 min-[1200px]:w-6" strokeWidth={1.8} aria-hidden="true" />
            <span className="font-display text-sm leading-none min-[1200px]:text-base">{activeScore} <span className="hidden min-[1200px]:inline">{t('score', 'Score')}</span></span>
          </div>
          <EconomySummary compact gameHeader />
          <button onClick={toggleMute} className="flex h-9 w-9 items-center justify-center text-gold transition-colors hover:text-[#ffe17b] min-[1200px]:h-10 min-[1200px]:w-10" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
            <SoundIcon className={`h-5 w-5 min-[1200px]:h-6 min-[1200px]:w-6 ${isMuted ? 'text-ruby' : ''}`} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full border border-gold/65 bg-[radial-gradient(circle_at_50%_35%,rgba(234,179,8,0.3),rgba(0,0,0,0.2))] text-gold shadow-[inset_0_0_12px_rgba(234,179,8,0.12)] min-[700px]:flex min-[1200px]:h-12 min-[1200px]:w-12" title={user?.displayName || t('playerProfile', 'Player profile')} aria-label={t('playerProfile', 'Player profile')}>
            <ProfileIcon className="h-5 w-5 min-[1200px]:h-6 min-[1200px]:w-6" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button onClick={handleMenuClick} className="flex h-9 w-9 items-center justify-center text-gold transition-colors hover:text-ruby min-[1200px]:h-10 min-[1200px]:w-10" title={t('exitGame', 'Exit Game')}>
            <ExitIcon className="h-5 w-5 min-[1200px]:h-6 min-[1200px]:w-6" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isGameMenuOpen && <button type="button" aria-label={t('closeMenu', 'Close menu')} onClick={() => setIsGameMenuOpen(false)} className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[1px]" />}
      <aside id="game-navigation-pane" aria-label={t('gameNavigation', 'Game navigation')} className={`lobby-navigation-pane fixed bottom-0 left-0 top-0 z-[70] flex w-[min(18rem,86vw)] flex-col border-r border-gold/35 bg-[#11100e]/[0.98] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] shadow-[12px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-transform duration-300 ${isGameMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-4 border-b border-gold/25 pb-3 font-display text-xs font-bold uppercase tracking-[0.22em] text-gold/75">{t('gameMenu', 'Game Menu')}</div>
        <nav className="flex flex-col" aria-label={t('gameInformation', 'Game information')}>
          <button type="button" onClick={() => { setIsGameMenuOpen(false); onShowTutorial(); }} className="lobby-navigation-item"><HowToPlayIcon className="h-6 w-6" aria-hidden="true" />{t('howToPlay', 'How to Play')}</button>
          <button type="button" onClick={() => { setIsGameMenuOpen(false); onShowRules(); }} className="lobby-navigation-item"><RulesIcon className="h-6 w-6" aria-hidden="true" />{t('rules', 'Rules')}</button>
          <button type="button" onClick={() => { setIsGameMenuOpen(false); onShowHistory(); }} className="lobby-navigation-item"><HistoryIcon className="h-6 w-6" aria-hidden="true" />{t('history', 'History')}</button>
          <button type="button" onClick={() => { setIsGameMenuOpen(false); onShowAbout(); }} className="lobby-navigation-item"><AboutIcon className="h-6 w-6" aria-hidden="true" />{t('aboutUs', 'About Us')}</button>
        </nav>
      </aside>
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

const FirstGameHelper = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const { state } = useGame();
  const CloseIcon = DYUT_ICONS.close;

  if (!isVisible || !state || isGameOverState(state)) return null;

  const activePlayerId = getActiveTurnPlayerId(state);
  const activePlayer = state.players?.[activePlayerId];
  const isBotTurn = state.bots?.includes(activePlayerId);
  const isMyTurn = canLocalClientAct(state) && !isBotTurn;
  const turnQueue = state.turnQueue || [];
  const canRoll = !state.hasRolledThisTurn || !state.rollingPhaseComplete;
  const canSpawn = isMyTurn && turnQueue.some((roll) => (
    roll.d1 === roll.d2 && activePlayer?.pieces?.some((position) => position === -1) && canSpawnPiece(activePlayerId, roll.sum, state)
  ));
  const hasPlayableMove = isMyTurn && turnQueue.length > 0 && hasAnyPlayableMove(activePlayerId, state);

  let titleKey = 'firstGameHelpTitleWatch';
  let titleFallback = 'Watch the turn';
  let bodyKey = 'firstGameHelpBodyWatch';
  let bodyFallback = 'When it is your turn, the dice and playable pieces will light up.';

  if (isMyTurn && canRoll) {
    titleKey = 'firstGameHelpTitleRoll';
    titleFallback = 'Roll the dice';
    bodyKey = 'firstGameHelpBodyRoll';
    bodyFallback = 'Tap the dice panel to roll. Doubles can let you spawn a piece from your base.';
  } else if (canSpawn) {
    titleKey = 'firstGameHelpTitleSpawn';
    titleFallback = 'Spawn a piece';
    bodyKey = 'firstGameHelpBodySpawn';
    bodyFallback = 'You rolled a double. Select a highlighted base piece, then choose Spawn.';
  } else if (hasPlayableMove) {
    titleKey = 'firstGameHelpTitleMove';
    titleFallback = 'Move a piece';
    bodyKey = 'firstGameHelpBodyMove';
    bodyFallback = 'Select a highlighted piece on the board, then choose one of the available move values.';
  } else if (isMyTurn && turnQueue.length > 0) {
    titleKey = 'firstGameHelpTitleWait';
    titleFallback = 'No move available';
    bodyKey = 'firstGameHelpBodyWait';
    bodyFallback = 'If no legal move is possible, the game will end this turn automatically.';
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(clamp(13.5rem,24.5vh,15rem)+1rem)] z-[115] flex justify-center lg:inset-x-auto lg:bottom-6 lg:left-6 lg:block">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-gold/45 bg-[#050403]/94 p-4 text-left shadow-[0_0_34px_rgba(0,0,0,0.78),inset_0_0_28px_rgba(234,179,8,0.08)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
              {t('firstGameHelpEyebrow', 'Quick Tip')}
            </div>
            <h2 className="mt-1 font-display text-lg font-bold uppercase tracking-[0.12em] text-gold text-glow-gold sm:text-xl">
              {t(titleKey, titleFallback)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-black/45 text-white/70 transition-colors hover:text-gold"
            aria-label={t('close', 'Close')}
          >
            <CloseIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 font-sans text-sm font-semibold leading-relaxed text-white/90">
          {t(bodyKey, bodyFallback)}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-xl border border-gold/55 bg-gold/12 px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-gold shadow-[0_0_18px_rgba(251,191,36,0.2)] transition-all hover:scale-[1.02] hover:bg-gold/20"
        >
          {t('firstGameHelpDismiss', 'Got it')}
        </button>
      </div>
    </div>
  );
};

function App() {
  const { t } = useTranslation();
  const qaPreviewScreen = getQaPreviewScreen();
  const isDesktop = useIsDesktop();
  const isShortMobileHeight = useIsShortMobileHeight();
  const isCompactLandscape = useIsCompactLandscape();
  const qaScenarioConfig = getQaCaptureScenarioConfig(qaPreviewScreen);
  const [view, setView] = useState(() => qaScenarioConfig ? 'game' : 'menu'); // 'menu', 'rules', 'setup', 'game'
  const [gameConfig, setGameConfig] = useState(() => qaScenarioConfig); // { playerCount, playerColors, isVoidRuleEnabled }
  const [user, setUser] = useState(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [joinGameId, setJoinGameId] = useState(null);
  const [hasCachedGame, setHasCachedGame] = useState(() => hasOfflineResumeCache());
  const [deviceOnlineGameId, setDeviceOnlineGameId] = useState(() => localStorage.getItem(ONLINE_GAME_ID_KEY));
  const [accountOnlineGameId, setAccountOnlineGameId] = useState(null);
  const [gameSessionKey, setGameSessionKey] = useState(0);
  const [gameInfoView, setGameInfoView] = useState(null);
  const [showFirstGameHelper, setShowFirstGameHelper] = useState(false);
  const [isMuted, setIsMuted] = useState(() => getEffectiveMuteState());
  const [portalAutoStartPending, setPortalAutoStartPending] = useState(false);
  const [portalInstantMultiplayerPending, setPortalInstantMultiplayerPending] = useState(false);
  const [pendingPlayWithFriendsConfig, setPendingPlayWithFriendsConfig] = useState(null);
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;
  const mobileHeaderReservedSpace = isShortMobileHeight ? MOBILE_HEADER_RESERVED_SPACE_SHORT : MOBILE_HEADER_RESERVED_SPACE;
  const mobileTrayReservedSpace = isShortMobileHeight ? MOBILE_TRAY_RESERVED_SPACE_SHORT : MOBILE_TRAY_RESERVED_SPACE;
  const mobileBoardSize = `min(calc(96vw - 0.75rem), calc(100dvh - ${mobileHeaderReservedSpace} - ${mobileTrayReservedSpace} - env(safe-area-inset-bottom) - ${isShortMobileHeight ? '0.65rem' : '1.25rem'}))`;
  const shouldUseCompactLandscapeLayout = !isDesktop && isCompactLandscape;
  const compactLandscapeBoardSize = `min(calc(100dvh - ${mobileHeaderReservedSpace} - env(safe-area-inset-bottom) - 1rem), 58vw)`;
  const viewRef = useRef(view);
  const joinGameIdRef = useRef(joinGameId);
  const authIdentityRef = useRef(null);
  const portalAutoStartQueuedRef = useRef(false);
  const portalInstantMultiplayerQueuedRef = useRef(false);

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
    clearCrazyGamesOfflineResume().catch(console.error);
    setHasCachedGame(false);
  };

  const handleReconnectOnline = (id) => {
    if (!id) return;
    setJoinGameId(id);
    window.history.pushState({}, '', `?join=${id}`);
  };

  const toggleMute = () => {
    setIsMuted(toggleUserMutePreference());
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

        const authIdentity = currentUser
          ? `${currentUser.uid}:${currentUser.isAnonymous ? 'anonymous' : 'account'}`
          : 'signed-out';
        if (authIdentityRef.current !== authIdentity) {
          setIsAuthResolved(false);
          authIdentityRef.current = authIdentity;
        }

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
        setIsAuthResolved(true);
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
            if (qaPreviewScreen) return;
            const hasPortalOfflineResume = await loadCrazyGamesOfflineResumeToLocal();
            if (isMounted && hasPortalOfflineResume) setHasCachedGame(true);

            const maybeQueuePortalFirstSession = async () => {
              if (
                !isMounted ||
                portalAutoStartQueuedRef.current ||
                portalInstantMultiplayerQueuedRef.current ||
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

                const storedStats = await window.CrazyGames.SDK.data.getItem(CRAZYGAMES_STATS_KEY);
                const stats = parseCrazyGamesStoredValue(storedStats);
                if (stats || storedStats != null) return;

                portalAutoStartQueuedRef.current = true;
                await window.CrazyGames.SDK.data.setItem(CRAZYGAMES_STATS_KEY, serializeCrazyGamesStoredValue({
                  gamesPlayed: 0,
                  wins: 0,
                  hasSeenPortalIntro: true
                }));

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

            if (
              window.CrazyGames.SDK.game.isInstantMultiplayer &&
              isMounted &&
              viewRef.current === 'menu' &&
              !joinGameIdRef.current &&
              !portalInstantMultiplayerQueuedRef.current
            ) {
              portalInstantMultiplayerQueuedRef.current = true;
              setPortalAutoStartPending(false);
              setPortalInstantMultiplayerPending(true);
            } else {
              await maybeQueuePortalFirstSession();
            }

            cgJoinListener = (inviteParams) => {
              if (inviteParams && inviteParams.roomId) {
                setView('menu'); // Force route to lobby if they are in a match/tutorial
                joinGameIdRef.current = inviteParams.roomId;
                setPortalInstantMultiplayerPending(false);
                setPortalAutoStartPending(false);
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

  const handleStartNewGame = (config) => {
    handleGameSetupComplete(config);
  };

  const handleStartSameGame = () => {
    if (!gameConfig) {
      handleWipeAndGoToMenu();
      return;
    }

    if (gameConfig.isOnline) {
      const rematchMatchType = gameConfig.matchType
        || (gameConfig.isTeamMode ? '2v2' : gameConfig.playerCount === 4 ? 'ffa' : '1v1');

      setPendingPlayWithFriendsConfig({
        matchType: rematchMatchType,
        isQuickGame: Boolean(gameConfig.isQuickGame),
        isVoidRuleEnabled: gameConfig.isVoidRuleEnabled !== false,
        botDifficulty: gameConfig.botDifficulty || 'easy'
      });
      localStorage.removeItem(ONLINE_GAME_ID_KEY);
      setDeviceOnlineGameId(null);
      setJoinGameId(null);
      window.history.replaceState({}, '', window.location.pathname);
      setGameConfig(null);
      setGameSessionKey(prev => prev + 1);
      setGameInfoView(null);
      setShowFirstGameHelper(false);
      setView('menu');
      return;
    }

    clearOfflineResumeCache();
    setGameConfig({ ...gameConfig, isOnline: false, gameId: null, status: 'playing' });
    setGameSessionKey(prev => prev + 1);
    setGameInfoView(null);
    setShowFirstGameHelper(shouldShowFirstGameHelp());
    setView('game');
  };

  const handleResumeGame = () => {
    const savedCount = localStorage.getItem(PLAYER_COUNT_KEY);
    // We don't need to load the full config, just enough for the provider to work.
    // The provider itself will load the full state from storage.
    setGameConfig({ playerCount: parseInt(savedCount, 10) });
    setGameSessionKey(prev => prev + 1);
    setGameInfoView(null);
    setShowFirstGameHelper(shouldShowFirstGameHelp());
    setView('game');
  };

  useEffect(() => {
    let cleanup;
    let cancelled = false;

    if (!IS_PORTAL) return undefined;

    const bindSettings = async () => {
      try {
        cleanup = await bindCrazyGamesMuteSetting();
        if (!cancelled) setIsMuted(getEffectiveMuteState());
      } catch (error) {
        console.error('CrazyGames mute setting setup failed:', error);
      }
    };

    bindSettings();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  const handleGameSetupComplete = (config) => {
    setPortalAutoStartPending(false);
    setPortalInstantMultiplayerPending(false);
    setPendingPlayWithFriendsConfig(null);
    if (!config.isOnline) {
      localStorage.removeItem(GAME_STATE_KEY);
      clearCrazyGamesOfflineResume().catch(console.error);
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
    setShowFirstGameHelper(shouldShowFirstGameHelp());
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
    setPendingPlayWithFriendsConfig(null);
    setGameConfig(null);
    setGameInfoView(null);
    setShowFirstGameHelper(false);
    setView('menu');
    if (IS_PORTAL && window.CrazyGames?.SDK) {
      try { window.CrazyGames.SDK.game.leftRoom(); } catch (e) {}
    }
  };

  const handleReturnToMenu = () => {
    window.history.pushState({}, '', window.location.pathname);
    setJoinGameId(null);
    setPendingPlayWithFriendsConfig(null);
    setGameConfig(null);
    setGameInfoView(null);
    setShowFirstGameHelper(false);
    setView('menu');
    if (IS_PORTAL && window.CrazyGames?.SDK) {
      try { window.CrazyGames.SDK.game.leftRoom(); } catch (e) {}
    }
  };

  const renderView = () => {
    if (qaPreviewScreen === 'victory') {
      return <VictoryScreen winnerId="QA Champion" onNewGame={() => setView('menu')} onHome={() => setView('menu')} />;
    }

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
              user={user}
            />
            {isDesktop ? (
              <div className="relative z-10 flex h-[100dvh] w-full overflow-hidden pt-[4.25rem]">
                <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden px-4 py-3 xl:px-8 xl:py-4">
                  <Board onGoToMenu={handleWipeAndGoToMenu} onNewGame={handleStartSameGame} layoutMode="desktop" />
                </div>
                <DiceTray layoutMode="desktop" />
              </div>
            ) : shouldUseCompactLandscapeLayout ? (
              <div className={`relative z-10 flex h-[100dvh] w-full overflow-hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${isShortMobileHeight ? 'pt-[3.65rem]' : 'pt-[clamp(3.8rem,8.5vh,4.3rem)]'}`}>
                <div className="flex min-h-0 w-full items-center justify-center gap-3 sm:gap-4">
                  <div className="shrink-0" style={{ width: compactLandscapeBoardSize, height: compactLandscapeBoardSize }}>
                    <Board onGoToMenu={handleWipeAndGoToMenu} onNewGame={handleStartSameGame} layoutMode="mobile" hideActiveBaseOnMobile={false} />
                  </div>
                  <div className="z-20 min-w-[18rem] max-w-[360px] flex-1 self-stretch">
                    <DiceTray layoutMode="compact" />
                  </div>
                </div>
              </div>
            ) : (
              <div className={`relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 ${isShortMobileHeight ? 'pt-[3.65rem]' : 'pt-[clamp(3.8rem,8.5vh,4.3rem)]'}`}>
                <div className={`flex min-h-0 flex-1 items-center overflow-hidden ${isShortMobileHeight ? 'justify-start pt-0.5 pb-1' : 'justify-center pt-2 pb-2 [@media(min-height:780px)]:items-end [@media(min-height:780px)]:pb-3 [@media(min-height:900px)]:pb-4'}`}>
                  <div style={{ width: mobileBoardSize, height: mobileBoardSize }}>
                    <Board onGoToMenu={handleWipeAndGoToMenu} onNewGame={handleStartSameGame} layoutMode="mobile" />
                  </div>
                </div>
                <div className="z-20 px-0 pt-1.5">
                  <DiceTray layoutMode="mobile" />
                </div>
              </div>
            )}
            <FirstGameHelper isVisible={showFirstGameHelper && !gameInfoView} onClose={() => setShowFirstGameHelper(false)} />
            <GameInfoOverlay infoView={gameInfoView} onClose={() => setGameInfoView(null)} />
          </GameProvider>
        );
      case 'menu':
      default:
        return <UnifiedLobby 
          onStartGame={handleStartNewGame} 
          onResumeGame={handleResumeGame} 
          onClearOfflineResume={clearOfflineResumeCache}
          onShowRules={() => setView('rules')} 
          onShowTutorial={() => setView('tutorial')}
          onShowHistory={() => setView('history')}
          onShowAbout={() => setView('about')}
          hasCachedGame={hasCachedGame} 
          resumeOnlineGameId={resumeOnlineGameId}
          joinGameId={joinGameId} 
          user={user} 
          autoStartPortalIntro={IS_PORTAL && !qaPreviewScreen && portalAutoStartPending}
          onPortalAutoStartConsumed={() => setPortalAutoStartPending(false)}
          autoStartInstantMultiplayer={IS_PORTAL && !qaPreviewScreen && portalInstantMultiplayerPending}
          onInstantMultiplayerConsumed={() => setPortalInstantMultiplayerPending(false)}
          autoStartPlayWithFriendsConfig={pendingPlayWithFriendsConfig}
          onPlayWithFriendsAutoStartConsumed={() => setPendingPlayWithFriendsConfig(null)}
          onReconnectOnline={handleReconnectOnline}
          qaShowOfflineResume={qaPreviewScreen === 'resume'}
        />;
    }
  };

  return (
    <EconomyProvider user={user} authReady={isAuthResolved}>
      <main className={`h-[100dvh] w-full bg-[var(--color-charcoal)] flex items-center justify-center relative overflow-hidden outline-none font-sans ${view === 'menu' || view === 'game' ? 'p-0' : 'p-3 sm:p-4'}`}>
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
    </EconomyProvider>
  )
}

export default App

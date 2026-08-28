import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useGame, ACTION_TYPES, TURN_TIMER_WARNING_MS, AFK_BOT_TAKEOVER_STRIKES, canLocalClientAct, doesLocalClientOwnActiveTurn, getActiveTurnPlayerId, getTurnRemainingMs, getTurnTimeoutMs, isGameOverState, shouldLocalClientAutoControlTurn } from './GameContext';
import { hasAnyPlayableMove, getAutoMove, canSpawnPiece } from './gameLogic';
import { getEffectiveMuteState, playSound } from './audio';
import blehMochiGif from './assets/bleh-mochi.gif';
import { useAIBot } from './useAIBot';
import { useTranslation } from 'react-i18next';
import { DYUT_ICONS } from './dyut-icons';
import { getPieceSkin } from './pieceSkins';

const DICE_FACES = [1, 3, 4, 6];
const ROLL_ANIMATION_DURATION_MS = 400;
const AUTO_MOVE_DISPATCH_DELAY_MS = 200;
const TURN_COMPLETE_DISPATCH_DELAY_MS = 250;
const renderDocumentPortal = (content) => {
  const target = globalThis.document?.body;
  return target ? createPortal(content, target) : content;
};

// A single die face component, styled to look like a long die (pasa)
const Die = ({ value, isRolling, compact = false, isHighlighted = false, ornate = false, fluid = false }) => (
  <div
    className={`relative flex items-center justify-center border transition-transform ${ornate ? `${fluid ? 'aspect-square h-auto w-[clamp(4rem,30%,7rem)] flex-none rounded-[clamp(0.75rem,2vw,1.125rem)]' : compact ? 'aspect-square h-[clamp(2.75rem,6dvh,3.5rem)] flex-none rounded-[11px]' : 'aspect-square h-[clamp(4.5rem,17dvh,8.75rem)] flex-none rounded-[18px]'} bg-[linear-gradient(145deg,rgba(20,18,15,0.98),rgba(4,4,4,0.98))] shadow-[inset_0_0_26px_rgba(234,179,8,0.06),0_8px_18px_rgba(0,0,0,0.62)] ${isHighlighted ? 'border-gold/80' : 'border-gold/40'}` : `bg-black/45 shadow-[inset_0_0_18px_rgba(255,255,255,0.05),0_0_18px_rgba(0,0,0,0.55)] ${isHighlighted ? 'border-gold/55' : 'border-white/20'} ${compact ? 'h-[3.35rem] w-[3.35rem] rounded-lg' : `h-14 w-14 rounded-xl sm:h-20 sm:w-20 lg:h-24 lg:w-24 lg:rounded-2xl ${isHighlighted ? 'lg:border-gold/55' : 'lg:border-white/20'}`}`} ${isRolling ? 'animate-shake' : ''}`}
    data-die-face={ornate ? (fluid ? 'ornate-fluid' : compact ? 'ornate-compact' : 'ornate-desktop') : 'standard'}
  >
    {ornate && (
      <>
        <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 rounded-tl-md border-l border-t border-gold/55" aria-hidden="true"></span>
        <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 rounded-tr-md border-r border-t border-gold/55" aria-hidden="true"></span>
        <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 rounded-bl-md border-b border-l border-gold/55" aria-hidden="true"></span>
        <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 rounded-br-md border-b border-r border-gold/55" aria-hidden="true"></span>
      </>
    )}
    <span className={`font-display font-bold ${ornate ? `${fluid ? 'text-[clamp(1.75rem,4vw,3.5rem)]' : compact ? 'text-[clamp(1.8rem,5vh,2.7rem)]' : 'text-[clamp(2rem,8dvh,5rem)]'} leading-none text-gold drop-shadow-[0_0_12px_rgba(234,179,8,0.35)]` : `text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] ${compact ? 'text-[1.65rem]' : 'text-3xl sm:text-5xl lg:text-6xl'}`}`}>{value}</span>
  </div>
);

const TurnTimerOutline = ({ progress, isCritical, isActive = false }) => {
  if (progress == null) return null;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const strokeColor = !isActive ? 'rgba(148, 163, 184, 0.7)' : isCritical ? 'rgba(244, 63, 94, 0.96)' : 'rgba(251, 191, 36, 0.96)';
  const glowColor = !isActive ? 'rgba(148, 163, 184, 0.18)' : isCritical ? 'rgba(244, 63, 94, 0.56)' : 'rgba(251, 191, 36, 0.58)';
  const strokeWidth = isActive ? 4 : 2.75;

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="12"
          ry="12"
          fill="none"
          stroke={isActive ? 'rgba(251,191,36,0.22)' : 'rgba(148,163,184,0.16)'}
          strokeWidth="1.5"
        />
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="12"
          ry="12"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={`${clampedProgress} 1`}
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
        />
      </svg>
    </div>
  );
};

const PanelPiece = ({ color, skinId, isLocked, isClickable, onClick }) => {
  const skin = getPieceSkin(skinId);
  const bgClass = {
    yellow: 'bg-piece-yellow',
    black: 'bg-piece-black',
    green: 'bg-piece-green',
    blue: 'bg-piece-blue',
    red: 'bg-red-400',
    purple: 'bg-purple-400',
    ruby: 'bg-ruby',
    sapphire: 'bg-sapphire',
    emerald: 'bg-emerald',
    amber: 'bg-amber',
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`flex aspect-square w-full items-center justify-center rounded-lg border transition-all ${isLocked ? 'border-gold/25 bg-black/45' : 'border-white/10 bg-black/18'} ${isClickable ? 'cursor-pointer hover:scale-105 hover:border-gold/55' : 'cursor-default'}`}
    >
      <div data-piece-skin={skin.id} className={`flex h-[58%] w-[58%] items-center justify-center rounded-full border border-white/60 font-serif text-[clamp(0.75rem,4vw,1.35rem)] font-black leading-none text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.4)] ${bgClass} ${isLocked ? '' : 'opacity-60'}`}>
        {skin.id === 'classic' ? (
          <span aria-hidden="true" className="h-[24%] w-[24%] shrink-0 rounded-full bg-white/95 shadow-[0_0_2px_rgba(255,255,255,0.9)]" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center leading-none">{skin.symbol}</span>
        )}
      </div>
    </button>
  );
};

const DiceTray = ({ layoutMode = 'desktop' }) => {
  const { state, dispatch, serverAuthorityEnabled } = useGame();
  const isCompactLandscapeTray = layoutMode === 'compact';
  const [lastRoll, setLastRoll] = useState({ d1: null, d2: null });
  const [isRolling, setIsRolling] = useState(false);
  const [showVoidGif, setShowVoidGif] = useState(false);
  const [isBoardAnimating, setIsBoardAnimating] = useState(false);
  const { t } = useTranslation();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const rollAnimationIntervalRef = useRef(null);
  const serverRollRequestRef = useRef(null);
  const [isMuted, setIsMuted] = useState(() => getEffectiveMuteState());
  const [now, setNow] = useState(() => Date.now());
  const CrownIcon = DYUT_ICONS.currentTurn;

  useEffect(() => {
    const handler = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handler);
    return () => window.removeEventListener('dyut-mute-change', handler);
  }, []);

  useEffect(() => {
    const handleAnim = (e) => setIsBoardAnimating(e.detail);
    window.addEventListener('dyut-animating', handleAnim);
    return () => window.removeEventListener('dyut-animating', handleAnim);
  }, []);

  useEffect(() => {
    setLastRoll({ d1: null, d2: null });
  }, [state.currentPlayer]);

  // Server-authoritative rolls are generated by the callable, not by the
  // browser animation. Keep the visual roll moving until the committed server
  // version arrives so a client-side face is never mistaken for the real roll.
  useEffect(() => {
    if (state.lastRoll?.d1 == null) return;

    const pendingRequest = serverRollRequestRef.current;
    if (pendingRequest) {
      const committedVersion = Number(state.version);
      if (!Number.isInteger(committedVersion) || committedVersion <= pendingRequest.baseVersion) return;
      clearInterval(rollAnimationIntervalRef.current);
      rollAnimationIntervalRef.current = null;
      serverRollRequestRef.current = null;
      setIsRolling(false);
      setIsEvaluating(false);
    }

    setLastRoll({ d1: state.lastRoll.d1, d2: state.lastRoll.d2 ?? null });
  }, [state.lastRoll?.d1, state.lastRoll?.d2, state.version]);

  useEffect(() => () => {
    clearInterval(rollAnimationIntervalRef.current);
  }, []);

  const activePlayerId = getActiveTurnPlayerId(state);
  const isAutoControlledTurn = shouldLocalClientAutoControlTurn(state);
  const isBotPlaying = isAutoControlledTurn;
  const activeBots = useMemo(() => {
    if (!isAutoControlledTurn) return state.bots || [];
    return [...new Set([...(state.bots || []), state.currentPlayer, activePlayerId])];
  }, [activePlayerId, isAutoControlledTurn, state.bots, state.currentPlayer]);
  const isMyTurn = canLocalClientAct(state);
  const isCurrentUserPlayer = doesLocalClientOwnActiveTurn(state);
  const activePlayer = state.players[activePlayerId];
  const activePlayerName = activePlayer?.name || activePlayerId;
  const activePlayerLabel = state.isOnline && isCurrentUserPlayer
    ? t('you', 'YOU')
    : activePlayerName;
  const activePlayerTextClass = {
    red: 'text-red-400',
    ruby: 'text-ruby',
    blue: 'text-blue-400',
    sapphire: 'text-sapphire',
    green: 'text-green-400',
    emerald: 'text-emerald',
    yellow: 'text-yellow-300',
    amber: 'text-amber',
    purple: 'text-purple-400',
    black: 'text-white/80',
  }[activePlayer?.color] || 'text-gold';
  const isRollingPhaseActive = state.hasRolledThisTurn && !state.rollingPhaseComplete;
  const hasValidSpawn = state.turnQueue.some(r => r.d1 === r.d2 && canSpawnPiece(activePlayerId, r.sum, state));
  const remainingMs = getTurnRemainingMs(state, now);
  const hasTurnTimer = remainingMs != null;
  const turnTimeoutMs = getTurnTimeoutMs(state);
  const turnTimerProgress = hasTurnTimer ? remainingMs / turnTimeoutMs : null;
  const isTimerCritical = remainingMs != null && remainingMs <= TURN_TIMER_WARNING_MS;
  const activePlayerStrikeCount = state.afkStrikes?.[activePlayerId] || 0;
  const isActivePlayerBotControlled = !!state.bots?.includes(activePlayerId);
  const hasAfkStrikeWarning = state.isOnline && activePlayerStrikeCount > 0;
  const afkStrikeProgress = Math.min(100, (activePlayerStrikeCount / AFK_BOT_TAKEOVER_STRIKES) * 100);
  const afkWarningText = isActivePlayerBotControlled
    ? t('afkBotTakeoverWarning', 'Bot control is now active for this player.')
    : t('afkStrikeWarning', { count: activePlayerStrikeCount, max: AFK_BOT_TAKEOVER_STRIKES, defaultValue: '{{count}} of {{max}} strikes before bot takeover.' });
  const isGameOver = isGameOverState(state);
  const isTimerActive = isMyTurn && !isGameOver;
  const useServerAuthority = serverAuthorityEnabled && state.isOnline;

  useEffect(() => {
    if (!hasTurnTimer) {
      setNow(Date.now());
      return undefined;
    }

    const timerId = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(timerId);
  }, [hasTurnTimer, state.currentPlayer, state.turnStartedAt]);

  // Auto-dismiss Void Roll for both bots (fast) and humans (after a delay)
  useEffect(() => {
    if (showVoidGif) {
      const delay = isAutoControlledTurn ? 600 : 2000;
      const timer = setTimeout(() => {
        setShowVoidGif(false);
        if (isMyTurn) dispatch({ type: ACTION_TYPES.END_TURN, _autoControlledAction: isAutoControlledTurn });
        setLastRoll({ d1: null, d2: null });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [showVoidGif, isAutoControlledTurn, dispatch, isMyTurn]);

  const handleRoll = useCallback(({ autoControlled = false } = {}) => {
    if (isGameOver) return;
    if (isRolling || isEvaluating) return;
    
    if (!isMuted) playSound(`${import.meta.env.BASE_URL}sounds/dice-roll.mp3`);
    setIsRolling(true);

    clearInterval(rollAnimationIntervalRef.current);
    const animationInterval = setInterval(() => {
      const d1 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const d2 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1, d2 });
    }, 80);
    rollAnimationIntervalRef.current = animationInterval;

    // Use a strict timeout instead of audio events to prevent stranded listeners and multiple dispatches.
    // Dispatch as soon as the visual roll finishes so the queue can reconcile from
    // the server without an additional artificial pause.
    setTimeout(() => {
      const scriptedRoll = state.scriptedRolls?.length
        ? state.scriptedRolls[state.scriptedRollIndex % state.scriptedRolls.length]
        : null;
      const final_d1 = scriptedRoll?.d1 ?? DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const final_d2 = scriptedRoll?.d2 ?? DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setIsEvaluating(true);

      if (useServerAuthority) {
        const baseVersion = Number.isInteger(state.version) ? state.version : 0;
        serverRollRequestRef.current = {
          baseVersion,
        };
        const command = dispatch({
          type: ACTION_TYPES.ROLL_DICE,
          payload: { d1: final_d1, d2: final_d2, sum: final_d1 + final_d2 },
          _autoControlledAction: autoControlled,
        });
        if (!command || typeof command.then !== 'function') {
          clearInterval(animationInterval);
          rollAnimationIntervalRef.current = null;
          serverRollRequestRef.current = null;
          setIsRolling(false);
          setIsEvaluating(false);
          return;
        }
        // The animation is deliberately tied to the callable's response, not
        // to a client-generated face. This also gives failed calls a clean
        // recovery path instead of leaving the tray permanently rolling.
        command.then((response) => {
          const remoteState = response?.state;
          const committedVersion = Number(remoteState?.version);
          if (response?.error || !remoteState || !Number.isInteger(committedVersion) || committedVersion <= baseVersion) {
            clearInterval(animationInterval);
            rollAnimationIntervalRef.current = null;
            serverRollRequestRef.current = null;
            setIsRolling(false);
            setIsEvaluating(false);
            return;
          }
          clearInterval(animationInterval);
          rollAnimationIntervalRef.current = null;
          serverRollRequestRef.current = null;
          setLastRoll({ d1: remoteState.lastRoll?.d1 ?? null, d2: remoteState.lastRoll?.d2 ?? null });
          setIsRolling(false);
          setIsEvaluating(false);
        });
        return;
      }

      clearInterval(animationInterval);
      rollAnimationIntervalRef.current = null;
      setLastRoll({ d1: final_d1, d2: final_d2 });
      setIsRolling(false);

      if (state.isVoidRuleEnabled && ((final_d1 === 1 && final_d2 === 3) || (final_d1 === 3 && final_d2 === 1))) {
        if (Math.random() < 0.25) setShowVoidGif(true);
        dispatch({ type: ACTION_TYPES.CLEAR_QUEUE, _autoControlledAction: autoControlled });
      } else {
        dispatch({
          type: ACTION_TYPES.ROLL_DICE,
          payload: { d1: final_d1, d2: final_d2, sum: final_d1 + final_d2 },
          _autoControlledAction: autoControlled
        });
        if (scriptedRoll) dispatch({ type: ACTION_TYPES.ADVANCE_SCRIPTED_ROLL, skipSync: true });
      }
      setIsEvaluating(false);
    }, ROLL_ANIMATION_DURATION_MS);
  }, [dispatch, isEvaluating, isGameOver, isMuted, isRolling, state.isOnline, state.isVoidRuleEnabled, state.scriptedRolls, state.scriptedRollIndex, state.version, useServerAuthority]);

  const handleRollControl = (event) => {
    if (isAutoControlledTurn && event?.isTrusted) return;
    if (!canAutoRoll) return;
    handleRoll();
  };

  const hasPlayableMoves = useMemo(() => hasAnyPlayableMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue]);
  const autoMoveAction = useMemo(() => getAutoMove(state.currentPlayer, state), [state.currentPlayer, state.players, state.turnQueue, state.hasRolledThisTurn, state.rollingPhaseComplete]);

  // --- New, Reload-Safe Turn Logic ---
  const hasRollsInQueue = state.turnQueue.length > 0;
  
  // A player can roll if they haven't rolled this turn OR they are still in their rolling phase (doubles streak).
  const canRoll = !state.hasRolledThisTurn || !state.rollingPhaseComplete;
  const canAutoRoll = !isGameOver && canRoll && !isRolling && !isEvaluating && !showVoidGif && isMyTurn;
  const canTriggerRoll = canAutoRoll && !isAutoControlledTurn;
  // Activate AI hook (it safely idles if the current player is not in state.bots)
  useAIBot(activeBots, state.botDifficulty || 'hard', isBoardAnimating);

  useEffect(() => {
    if (!isAutoControlledTurn || !canAutoRoll || isBoardAnimating) return;

    const timer = setTimeout(() => {
      handleRoll({ autoControlled: true });
    }, 800);

    return () => clearTimeout(timer);
  }, [isAutoControlledTurn, canAutoRoll, handleRoll, isBoardAnimating]);

  const isStuckUI = hasRollsInQueue && !hasPlayableMoves && !canRoll && !isRolling && !isEvaluating && !showVoidGif;

  useEffect(() => {
    // Don't auto-end if the player can still roll, is rolling, is evaluating, or is viewing the Void Roll popup
    if (isGameOver || canRoll || isRolling || isEvaluating || showVoidGif || !isMyTurn) return;

    // Pause all logic progression while pieces are actively moving on the board to prevent overlaps
    if (isBoardAnimating) return;

    // Automatically dispatch a move if the player only has exactly 1 valid option
    if (autoMoveAction) {
      const timer = setTimeout(() => {
        dispatch({ ...autoMoveAction, _autoControlledAction: isAutoControlledTurn });
      }, AUTO_MOVE_DISPATCH_DELAY_MS);
      return () => clearTimeout(timer);
    }

    const isStuck = hasRollsInQueue && !hasPlayableMoves;
    const isDone = state.hasRolledThisTurn && !hasRollsInQueue;

    if (isStuck || isDone) {
      const timer = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.END_TURN, _autoControlledAction: isAutoControlledTurn });
        setLastRoll({ d1: null, d2: null });
      }, TURN_COMPLETE_DISPATCH_DELAY_MS);

      return () => clearTimeout(timer);
    }
  }, [state.hasRolledThisTurn, hasRollsInQueue, hasPlayableMoves, canRoll, isRolling, isEvaluating, showVoidGif, dispatch, autoMoveAction, isMyTurn, isBoardAnimating, isGameOver]);


  const trayShellClass = layoutMode === 'mobile'
    ? 'relative z-10 flex h-[clamp(13.5rem,24.5vh,15rem)] w-full min-w-0 max-w-none flex-col items-center gap-2 overflow-hidden rounded-[22px] border border-gold/45 bg-[#080604]/92 p-2 shadow-[0_0_42px_rgba(0,0,0,0.82),inset_0_0_36px_rgba(234,179,8,0.07)] transition-all duration-500 [@media(orientation:landscape)]:h-[15rem] sm:rounded-[28px] sm:p-4'
    : isCompactLandscapeTray
      ? 'relative z-10 flex h-full w-full min-h-0 max-w-none flex-col items-center gap-[clamp(0.35rem,1.5%,0.75rem)] overflow-hidden rounded-[clamp(1rem,2.5vw,1.75rem)] border border-gold/50 bg-[#050403]/82 p-[clamp(0.6rem,2%,1.25rem)] shadow-[0_0_34px_rgba(0,0,0,0.78),inset_0_0_30px_rgba(234,179,8,0.08)] transition-all duration-500'
      : 'relative z-10 flex h-full w-[clamp(24rem,26.4vw,28rem)] shrink-0 flex-col items-center overflow-x-hidden overflow-y-auto border-l border-gold/35 bg-[linear-gradient(180deg,rgba(16,17,17,0.97),rgba(7,7,7,0.98))] px-[clamp(1.5rem,1.9vw,2rem)] pb-[clamp(0.75rem,2.2dvh,2rem)] pt-[clamp(0.75rem,3dvh,2.5rem)] shadow-[-12px_0_34px_rgba(0,0,0,0.2)]';

  return (
    <>
      {showVoidGif && renderDocumentPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-black/80 p-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm"
          data-void-roll-overlay="true"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-roll-title"
            className="glass-panel max-h-[calc(100dvh-1.5rem)] w-[min(90vw,24rem)] overflow-y-auto overscroll-contain rounded-3xl border border-ruby/30 p-[clamp(1rem,4dvh,2rem)] text-center shadow-[0_0_50px_rgba(220,38,38,0.3)]"
          >
            <img src={blehMochiGif} alt="Void Roll" className="mx-auto max-h-[clamp(7rem,40dvh,16rem)] w-auto max-w-full rounded-2xl border border-white/10 object-contain shadow-lg" />
            <h2 id="void-roll-title" className="mt-[clamp(0.75rem,2dvh,1.5rem)] font-display text-[clamp(1.35rem,4dvh,1.875rem)] font-bold tracking-widest text-gold drop-shadow-md">{t('voidRollTitle')}</h2>
            <p className="mt-2 font-sans text-sm leading-relaxed text-white/70">
              {t('voidRollDescPart1')}<strong className="text-ruby drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">{t('voidRuleStrong')}</strong>{t('voidRollDescPart2')}
            </p>
            {isBotPlaying ? (
              <div className="mt-[clamp(1rem,3dvh,2rem)] w-full animate-pulse rounded-xl border border-ruby/50 bg-ruby/30 py-2.5 font-sans text-base font-bold text-white/80">
                {t('autoSkipping')}
              </div>
            ) : (
              <button 
                onClick={() => {
                  setShowVoidGif(false);
                  dispatch({ type: ACTION_TYPES.END_TURN });
                  setLastRoll({ d1: null, d2: null });
                }} 
                className="mt-[clamp(1rem,3dvh,2rem)] w-full rounded-xl bg-ruby/90 py-2.5 font-sans text-base font-bold text-white shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all hover:scale-[1.03] hover:bg-ruby"
              >
                {t('acceptFate')}
              </button>
            )}
          </section>
        </div>
      )}
      <div className={trayShellClass}>
        {layoutMode !== 'desktop' && (
          <>
            <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l border-t border-gold/70"></span>
            <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r border-t border-gold/70"></span>
            <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b border-l border-gold/70"></span>
            <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b border-r border-gold/70"></span>
          </>
        )}
        {isStuckUI && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl">
            <div className="bg-ruby text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.6)] flex flex-col items-center border border-white/20 animate-pulse">
              <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest text-center">{t('noValidMoves')}</span>
              <span className="font-sans text-xs sm:text-sm font-semibold opacity-80 mt-1 uppercase tracking-wider">{t('skippingTurn')}</span>
            </div>
          </div>
        )}
        <div
          className={`${layoutMode === 'mobile' ? 'grid w-full grid-cols-[minmax(0,1fr)_minmax(124px,148px)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(164px,208px)]' : isCompactLandscapeTray ? 'flex h-[68%] min-h-0 w-full flex-none flex-col items-center gap-[clamp(0.35rem,2%,0.75rem)]' : 'flex h-[70%] min-h-[14rem] w-full flex-none flex-col items-center'}`}
          data-dice-tray-section="controls"
        >
          <div className={`${layoutMode === 'mobile' ? 'flex min-w-0 flex-col items-start rounded-2xl border border-gold/20 bg-black/28 px-3 py-2 shadow-[inset_0_0_18px_rgba(0,0,0,0.45)]' : isCompactLandscapeTray ? 'flex w-full flex-none flex-col items-center' : 'flex w-full flex-none flex-col items-center pt-[clamp(0.25rem,1.5dvh,1rem)]'}`}>
            <div className={`${layoutMode === 'mobile' ? 'w-full' : 'flex w-full min-w-0 items-center justify-center gap-2'}`}>
              <span className={`font-display uppercase ${layoutMode === 'mobile' ? 'mb-1 block text-xs tracking-[0.28em] text-white/65 lg:text-sm' : isCompactLandscapeTray ? 'shrink-0 text-[clamp(0.7rem,2vw,1rem)] tracking-[0.12em] text-white/65' : `shrink-0 text-[clamp(1rem,1.4vw,1.35rem)] tracking-[0.08em] ${activePlayerTextClass}`}`}>{t('active')}</span>
              {layoutMode !== 'mobile' && <span className="text-gold/65" aria-hidden="true">&middot;</span>}
              <div className={`min-w-0 truncate font-display font-bold uppercase leading-none text-glow-gold ${layoutMode === 'mobile' ? 'flex-1 text-lg text-gold sm:text-2xl' : isCompactLandscapeTray ? `w-full max-w-full text-center text-[clamp(0.9rem,2.5vw,1.5rem)] ${activePlayerTextClass}` : `max-w-[65%] text-[clamp(1rem,1.4vw,1.35rem)] tracking-[0.04em] ${activePlayerTextClass}`}`} title={activePlayerName}>
                {activePlayerLabel}
              </div>
            </div>
            {hasAfkStrikeWarning && (
              <div
                title={afkWarningText}
                aria-label={afkWarningText}
                className={`mt-2 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-[0_0_18px_rgba(0,0,0,0.35),inset_0_0_16px_rgba(0,0,0,0.24)] ${isActivePlayerBotControlled ? 'border-ruby/70 bg-[rgba(127,29,29,0.88)] text-white' : 'border-amber-300/75 bg-[rgba(120,53,15,0.88)] text-white'} ${layoutMode === 'mobile' ? 'w-full max-w-[12.5rem]' : isCompactLandscapeTray ? 'w-full' : 'lg:w-full lg:max-w-[15rem]'}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${isActivePlayerBotControlled ? 'bg-ruby animate-pulse' : 'bg-amber-300'}`} aria-hidden="true"></span>
                <span className="shrink-0 font-display text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gold">
                  {t('afkStrikesLabel', 'AFK Strikes')}
                </span>
                <span className="shrink-0 font-sans text-xs font-bold tabular-nums text-white">
                  {activePlayerStrikeCount} / {AFK_BOT_TAKEOVER_STRIKES}
                </span>
                <span className="h-1.5 min-w-[2.5rem] flex-1 overflow-hidden rounded-full bg-black/40" aria-hidden="true">
                  <span className={`block h-full rounded-full ${isActivePlayerBotControlled ? 'bg-ruby' : 'bg-amber-300'}`} style={{ width: `${afkStrikeProgress}%` }}></span>
                </span>
              </div>
            )}
            <div className={`${layoutMode === 'mobile' ? 'mt-2 grid w-full max-w-[7rem] grid-cols-4 gap-1 rounded-lg border border-gold/25 bg-black/34 p-1.5' : isCompactLandscapeTray ? 'mt-[clamp(0.35rem,2%,1rem)] flex w-full items-center justify-center gap-2 text-gold/85' : 'mt-[clamp(0.5rem,2dvh,1.5rem)] flex w-full items-center justify-center gap-4 text-gold/85'}`}>
              {layoutMode === 'mobile' ? (
                activePlayer?.pieces?.map((piecePosition, pieceIndex) => {
                  const isLocked = piecePosition === -1;
                  const canSpawnPieceFromTray = isLocked && isMyTurn && !isBotPlaying && hasValidSpawn && !isRollingPhaseActive && !isBoardAnimating;
                  return (
                    <PanelPiece
                      key={pieceIndex}
                      color={activePlayer?.color}
                      skinId={activePlayer?.pieceSkinId}
                      isLocked={isLocked}
                      isClickable={canSpawnPieceFromTray}
                      onClick={() => {
                        if (!canSpawnPieceFromTray) return;
                        window.dispatchEvent(new CustomEvent('dyut-mobile-spawn', {
                          detail: { playerId: activePlayerId, pieceIndex },
                        }));
                      }}
                    />
                  );
                })
              ) : (
                <>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold"></span>
                  <CrownIcon className={`${isCompactLandscapeTray ? 'h-[clamp(1rem,3vw,1.5rem)] w-[clamp(1rem,3vw,1.5rem)]' : 'h-6 w-6'} drop-shadow-[0_0_10px_rgba(234,179,8,0.65)]`} aria-hidden="true" />
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold"></span>
                </>
              )}
            </div>
          </div>
          {layoutMode === 'mobile' ? (
            <button
              type="button"
              id="dice-roll-btn"
              onClick={handleRollControl}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleRollControl(event);
                }
              }}
              disabled={!canAutoRoll}
              aria-label={canTriggerRoll ? t('tapDiceToRoll', 'Tap dice to roll') : t('currentDice', 'Current Dice')}
              className={`relative flex h-full min-h-[6.5rem] min-w-0 flex-col items-center justify-between gap-1 rounded-[18px] border px-1.5 py-1.5 transition-all ${canTriggerRoll ? 'cursor-pointer border-gold/75 bg-gold/[0.07] shadow-[0_0_18px_rgba(234,179,8,0.22),inset_0_0_16px_rgba(234,179,8,0.08)] active:scale-[0.99]' : 'cursor-default border-white/15 bg-black/25 grayscale-[0.18]'} ${isAutoControlledTurn ? 'pointer-events-none opacity-90 grayscale-[0.2]' : ''} disabled:opacity-100`}
              data-mobile-dice-panel="true"
            >
              <TurnTimerOutline progress={turnTimerProgress} isCritical={isTimerCritical} isActive={isTimerActive} />
              {turnTimerProgress != null && (
                <span
                  className={`pointer-events-none absolute left-0 top-1/2 z-10 w-1 -translate-y-1/2 rounded-r-full ${isTimerCritical ? 'bg-ruby shadow-[0_0_8px_rgba(244,63,94,0.75)]' : 'bg-gold shadow-[0_0_8px_rgba(234,179,8,0.65)]'}`}
                  style={{ height: `${Math.max(0, Math.min(1, turnTimerProgress)) * 100}%` }}
                  data-mobile-turn-progress="true"
                  aria-hidden="true"
                ></span>
              )}
              <span className="relative z-10 font-display text-[0.52rem] font-bold uppercase tracking-[0.18em] text-gold/90">{t('currentDice', 'Current Dice')}</span>
              <div className="relative z-10 flex w-full justify-center gap-1.5 sm:gap-2">
                <Die value={lastRoll.d1 || '-'} isRolling={isRolling} compact isHighlighted={canTriggerRoll} ornate />
                <Die value={lastRoll.d2 || '-'} isRolling={isRolling} compact isHighlighted={canTriggerRoll} ornate />
              </div>
              <span className={`relative z-10 font-display text-[0.52rem] font-bold uppercase tracking-[0.16em] ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-white/60'}`} data-mobile-roll-instruction="true">
                {canTriggerRoll ? t('tapDiceToRoll', 'Tap dice to roll') : (isRolling ? t('rolling') : t('currentDice', 'Current Dice'))}
              </span>
            </button>
          ) : isCompactLandscapeTray ? (
            <button
              type="button"
              id="dice-roll-btn"
              onClick={handleRollControl}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleRollControl(event);
                }
              }}
              disabled={!canAutoRoll}
              aria-label={canTriggerRoll ? t('rollDice') : t('currentDice', 'Current Dice')}
              className={`relative flex min-h-0 w-full flex-1 flex-col items-center rounded-[clamp(0.9rem,2.5vw,1.5rem)] border p-[clamp(0.35rem,1.5%,0.75rem)] transition-all ${canTriggerRoll ? 'cursor-pointer border-gold/80 bg-gold/10 shadow-[0_0_38px_rgba(251,191,36,0.55),inset_0_0_30px_rgba(234,179,8,0.16)] ring-2 ring-gold/30 hover:border-gold hover:bg-gold/20 active:scale-[0.99]' : 'cursor-default border-white/15 bg-black/30 grayscale-[0.18]'} ${isAutoControlledTurn ? 'pointer-events-none opacity-90 grayscale-[0.2]' : ''} disabled:opacity-100`}
            >
              <TurnTimerOutline progress={turnTimerProgress} isCritical={isTimerCritical} isActive={isTimerActive} />
              <div className="flex h-full min-h-0 w-full flex-col items-center justify-between rounded-[clamp(0.75rem,2vw,1.25rem)] border border-gold/65 bg-[linear-gradient(145deg,rgba(18,17,14,0.96),rgba(6,6,6,0.98))] px-[clamp(0.5rem,3%,1rem)] py-[clamp(0.45rem,3%,1rem)] shadow-[inset_0_0_28px_rgba(234,179,8,0.045)]">
                <span className="font-display text-[clamp(0.7rem,2vw,1rem)] font-bold uppercase tracking-[0.16em] text-gold">{t('currentDice', 'Current Dice')}</span>
                <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-[clamp(0.4rem,3%,1rem)]">
                  <Die value={lastRoll.d1 || '-'} isRolling={isRolling} isHighlighted={canTriggerRoll} ornate fluid />
                  <Die value={lastRoll.d2 || '-'} isRolling={isRolling} isHighlighted={canTriggerRoll} ornate fluid />
                </div>
                <span className={`font-display text-[clamp(0.65rem,1.8vw,0.95rem)] font-bold uppercase tracking-[0.14em] ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-gold/65'}`}>
                  {isRolling ? t('rolling') : t('tapDiceToRoll', 'Tap dice to roll')}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              id="dice-roll-btn"
              onClick={handleRollControl}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleRollControl(event);
                }
              }}
              disabled={!canAutoRoll}
              aria-label={canTriggerRoll ? t('rollDice') : t('currentDice', 'Current Dice')}
              className={`relative mt-[clamp(0.75rem,3.5dvh,2.5rem)] flex min-h-[9rem] w-full max-w-[23.125rem] flex-1 self-start flex-col items-center rounded-[30px] border border-gold/60 bg-black/20 p-3 shadow-[0_9px_24px_rgba(0,0,0,0.3),inset_0_0_24px_rgba(234,179,8,0.035)] transition-all min-[1200px]:max-h-[18rem] ${canTriggerRoll ? 'cursor-pointer hover:border-gold/90 active:scale-[0.995]' : 'cursor-default'} ${isAutoControlledTurn ? 'pointer-events-none opacity-90 grayscale-[0.2]' : ''} disabled:opacity-100`}
            >
              <TurnTimerOutline progress={turnTimerProgress} isCritical={isTimerCritical} isActive={isTimerActive} />
              <div className="flex h-full w-full flex-col items-center justify-between rounded-[24px] border border-gold/65 bg-[linear-gradient(145deg,rgba(18,17,14,0.96),rgba(6,6,6,0.98))] px-[clamp(0.9rem,1.5vw,1.35rem)] py-[clamp(0.75rem,1.8vh,1.1rem)] shadow-[inset_0_0_28px_rgba(234,179,8,0.045)]">
                <span className="font-display text-[clamp(0.78rem,1vw,1rem)] font-bold uppercase tracking-[0.16em] text-gold">{t('currentDice', 'Current Dice')}</span>
                <div className="flex w-full justify-center gap-3 xl:gap-4">
                  <Die value={lastRoll.d1 || '-'} isRolling={isRolling} isHighlighted={canTriggerRoll} ornate />
                  <Die value={lastRoll.d2 || '-'} isRolling={isRolling} isHighlighted={canTriggerRoll} ornate />
                </div>
                <span className={`font-display text-[clamp(0.72rem,0.95vw,0.95rem)] font-bold uppercase tracking-[0.14em] ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-gold/65'}`}>
                  {isRolling ? t('rolling') : t('tapDiceToRoll', 'Tap dice to roll')}
                </span>
              </div>
            </button>
          )}
        </div>

          <div
            className={`${layoutMode === 'mobile' ? 'mt-0.5 w-full min-w-0' : isCompactLandscapeTray ? 'w-full min-h-0 flex-1' : 'h-[30%] min-h-[5.25rem] w-full flex-none'}`}
            data-dice-tray-section="queue"
          >
          <div className={`relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center p-2 sm:min-h-[64px] sm:p-3 ${layoutMode === 'mobile' ? 'min-h-[4.6rem] w-full items-stretch justify-start rounded-2xl border border-gold/35 bg-black/34 px-2.5 py-2' : isCompactLandscapeTray ? 'h-full w-full min-h-0 justify-start rounded-[clamp(0.9rem,2.5vw,1.5rem)] border border-gold/35 bg-black/38 px-[clamp(0.5rem,2%,1rem)] py-[clamp(0.45rem,2%,1rem)]' : 'h-full w-full min-h-0 justify-start px-0 pb-0 pt-[clamp(0.5rem,1.5dvh,1rem)]'}`}>
            {layoutMode === 'mobile' ? (
              <div className="mb-1 flex w-full items-center justify-between gap-2">
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-gold/80">{t('queue')}</span>
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-gold/25 bg-black/35 px-1.5 text-[10px] font-bold leading-none text-white/70">
                  {state.turnQueue.length}
                </span>
              </div>
            ) : isCompactLandscapeTray ? (
              <div className="mb-[clamp(0.5rem,3%,1.25rem)] flex w-full items-center gap-[clamp(0.5rem,3%,1rem)]">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/70 to-gold"></span>
                <span className="font-display text-[clamp(0.75rem,2vw,1rem)] uppercase tracking-[0.16em] text-gold">{t('queue')}</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/70 to-gold"></span>
              </div>
            ) : (
              <div className="mb-[clamp(1.25rem,3dvh,2rem)] flex w-full items-center gap-4 [@media(max-height:650px)]:mb-2">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/70 to-gold"></span>
                <span className="font-display text-[clamp(1rem,1.4vw,1.35rem)] uppercase tracking-[0.08em] text-gold">{t('queue')}</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/70 to-gold"></span>
              </div>
            )}
            <div className={`${layoutMode === 'mobile' ? 'flex min-h-[2.25rem] w-full items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden' : isCompactLandscapeTray ? 'flex min-h-0 flex-1 w-full flex-wrap items-center justify-center gap-[clamp(0.35rem,2%,0.75rem)] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex min-h-[4rem] w-full items-start justify-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}`}>
            {state.turnQueue.length > 0 ? (
              state.turnQueue.map((roll, i) => {
                const rollText = roll.d2 == null ? roll.d1 : `${roll.d1} + ${roll.d2}`;
                return (
                  <span
                    key={i}
                    className={`font-bold px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm ${layoutMode === 'mobile' ? `snap-start shrink-0 rounded-xl border px-3 py-1.5 text-center ${i === 0 ? 'min-w-[5.5rem] bg-gold text-charcoal shadow-[0_0_14px_rgba(251,191,36,0.42)]' : 'min-w-[4.2rem] border-white/10 bg-white/10 text-white/75'}` : isCompactLandscapeTray ? `inline-flex h-[clamp(2.25rem,18%,3.5rem)] min-w-[clamp(3.5rem,24%,5.5rem)] shrink-0 items-center justify-center rounded-xl border px-[clamp(0.5rem,2%,0.9rem)] py-0 text-center font-display text-[clamp(0.75rem,2vw,1rem)] ${i === 0 ? 'border-[#ffe28b] bg-[linear-gradient(180deg,#ffd766,#e3a31f_55%,#b96f07)] text-[#17100a] shadow-[0_0_16px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(255,255,255,0.55)]' : 'border-gold/45 bg-[#171719] text-white/75 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]'}` : `inline-flex h-[clamp(2.5rem,7dvh,3.25rem)] min-w-[clamp(4.5rem,6vw,5.5rem)] shrink-0 items-center justify-center rounded-xl border px-3 py-0 text-center font-display text-[clamp(0.8rem,1.8dvh,1rem)] ${i === 0 ? 'border-[#ffe28b] bg-[linear-gradient(180deg,#ffd766,#e3a31f_55%,#b96f07)] text-[#17100a] shadow-[0_0_16px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(255,255,255,0.55)]' : 'border-gold/45 bg-[#171719] text-white/75 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]'}`}`}
                  >
                    <span className="block whitespace-nowrap">{rollText}</span>
                  </span>
                );
              })
            ) : (
              <span className={`text-white/75 text-[10px] sm:text-xs italic ${layoutMode === 'mobile' ? 'flex w-full items-center justify-center rounded-xl border border-dashed border-gold/20 bg-black/25 py-1.5 text-center not-italic' : layoutMode === 'desktop' || isCompactLandscapeTray ? 'pt-3 font-display text-[clamp(0.75rem,2vw,1rem)] not-italic text-white/55' : ''}`}>{t('empty')}</span>
            )}
            </div>
            {isCompactLandscapeTray && state.turnQueue.length > 8 && (
              <div className="pointer-events-none absolute inset-x-5 bottom-3 h-7 bg-gradient-to-t from-[#050403] via-[#050403]/82 to-transparent">
                <div className="absolute bottom-0 right-1 font-display text-[9px] uppercase tracking-[0.22em] text-gold/75">
                  {t('more', 'More')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DiceTray;

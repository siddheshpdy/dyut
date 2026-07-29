import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useGame, ACTION_TYPES, TURN_TIMER_WARNING_MS, AFK_BOT_TAKEOVER_STRIKES, canLocalClientAct, doesLocalClientOwnActiveTurn, getActiveTurnPlayerId, getTurnRemainingMs, getTurnTimeoutMs, isGameOverState, shouldLocalClientAutoControlTurn } from './GameContext';
import { hasAnyPlayableMove, getAutoMove, canSpawnPiece } from './gameLogic';
import { getEffectiveMuteState, playSound } from './audio';
import blehMochiGif from './assets/bleh-mochi.gif';
import { useAIBot } from './useAIBot';
import { useTranslation } from 'react-i18next';
import { DYUT_ICONS } from './dyut-icons';

const DICE_FACES = [1, 3, 4, 6];
const MOBILE_TRAY_HEIGHT = 'clamp(13.5rem, 24.5vh, 15rem)';

// A single die face component, styled to look like a long die (pasa)
const Die = ({ value, isRolling, compact = false, isHighlighted = false }) => (
  <div className={`flex items-center justify-center border bg-black/45 shadow-[inset_0_0_18px_rgba(255,255,255,0.05),0_0_18px_rgba(0,0,0,0.55)] transition-transform ${isHighlighted ? 'border-gold/55' : 'border-white/20'} ${compact ? 'h-[3.35rem] w-[3.35rem] rounded-lg' : `h-14 w-14 rounded-xl sm:h-20 sm:w-20 lg:h-24 lg:w-24 lg:rounded-2xl ${isHighlighted ? 'lg:border-gold/55' : 'lg:border-white/20'}`} ${isRolling ? 'animate-shake' : ''}`}>
    <span className={`font-display font-bold text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] ${compact ? 'text-[1.65rem]' : 'text-3xl sm:text-5xl lg:text-6xl'}`}>{value}</span>
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
          stroke="rgba(255,255,255,0.08)"
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

const PanelPiece = ({ color, isLocked, isClickable, onClick }) => {
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
      <div className={`flex h-[58%] w-[58%] items-center justify-center rounded-full border border-white/60 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.4)] ${bgClass} ${isLocked ? '' : 'opacity-60'}`}>
        <div className="h-[30%] w-[30%] rounded-full bg-white/80 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3)]"></div>
      </div>
    </button>
  );
};

const DiceTray = ({ layoutMode = 'desktop' }) => {
  const { state, dispatch } = useGame();
  const isCompactLandscapeTray = layoutMode === 'compact';
  const [lastRoll, setLastRoll] = useState({ d1: null, d2: null });
  const [isRolling, setIsRolling] = useState(false);
  const [showVoidGif, setShowVoidGif] = useState(false);
  const [isBoardAnimating, setIsBoardAnimating] = useState(false);
  const { t } = useTranslation();
  const [isEvaluating, setIsEvaluating] = useState(false);
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

    const animationInterval = setInterval(() => {
      const d1 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const d2 = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1, d2 });
    }, 80);

    // Use a strict timeout instead of audio events to prevent stranded listeners and multiple dispatches
    setTimeout(() => {
      clearInterval(animationInterval);

      const scriptedRoll = state.scriptedRolls?.length
        ? state.scriptedRolls[state.scriptedRollIndex % state.scriptedRolls.length]
        : null;
      const final_d1 = scriptedRoll?.d1 ?? DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      const final_d2 = scriptedRoll?.d2 ?? DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
      setLastRoll({ d1: final_d1, d2: final_d2 });

      setIsRolling(false);
      setIsEvaluating(true);

      // Introduce a 600ms gap for the user to perceive the final dice result before the game reacts
      setTimeout(() => {
        // CRITICAL: Check for Void Rule (1+3) before anything else
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
      }, 600);
    }, 600);
  }, [dispatch, isEvaluating, isGameOver, isMuted, isRolling, state.isVoidRuleEnabled, state.scriptedRolls, state.scriptedRollIndex]);

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
  const activeRollHighlightClass = canTriggerRoll
    ? 'border-gold/80 bg-gold/10 shadow-[0_0_34px_rgba(251,191,36,0.55),inset_0_0_28px_rgba(234,179,8,0.16)] ring-2 ring-gold/30 hover:border-gold hover:bg-gold/20'
    : 'border-white/15 bg-black/28 shadow-[inset_0_0_20px_rgba(0,0,0,0.52)] grayscale-[0.18]';

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
      }, 1200); // 1200ms delay to let the user visually track the move
      return () => clearTimeout(timer);
    }

    const isStuck = hasRollsInQueue && !hasPlayableMoves;
    const isDone = state.hasRolledThisTurn && !hasRollsInQueue;

    if (isStuck || isDone) {
      const timer = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.END_TURN, _autoControlledAction: isAutoControlledTurn });
        setLastRoll({ d1: null, d2: null });
      }, 1200); // 1.2-second delay, perfectly safe now because we wait for the board animation to finish.

      return () => clearTimeout(timer);
    }
  }, [state.hasRolledThisTurn, hasRollsInQueue, hasPlayableMoves, canRoll, isRolling, isEvaluating, showVoidGif, dispatch, autoMoveAction, isMyTurn, isBoardAnimating, isGameOver]);


 const trayShellClass = layoutMode === 'mobile'
    ? 'relative z-10 flex w-full min-w-0 max-w-none flex-col items-center gap-2 overflow-hidden rounded-[22px] border border-gold/45 bg-[#080604]/92 p-2 shadow-[0_0_42px_rgba(0,0,0,0.82),inset_0_0_36px_rgba(234,179,8,0.07)] transition-all duration-500 sm:rounded-[28px] sm:p-4'
    : isCompactLandscapeTray
      ? 'relative z-10 flex h-full w-full min-h-0 max-w-none flex-col items-center gap-2 overflow-hidden rounded-2xl border border-gold/50 bg-[#050403]/82 p-3 shadow-[0_0_34px_rgba(0,0,0,0.78),inset_0_0_30px_rgba(234,179,8,0.08)] transition-all duration-500'
    : 'relative z-10 flex w-full max-w-[98vw] flex-col items-center gap-4 rounded-2xl border border-gold/40 bg-black/55 p-4 shadow-[0_0_38px_rgba(0,0,0,0.72),inset_0_0_34px_rgba(234,179,8,0.06)] transition-all duration-500 sm:max-w-sm sm:rounded-3xl sm:p-6 lg:h-auto lg:max-h-[min(calc(100dvh-8.75rem),660px)] lg:min-h-0 lg:w-[330px] lg:max-w-[330px] lg:justify-start lg:gap-3 lg:border-gold/55 lg:bg-[#050403]/68 lg:p-4 lg:pt-3.5 lg:shadow-[0_0_44px_rgba(0,0,0,0.78),inset_0_0_40px_rgba(234,179,8,0.08)] xl:max-h-[min(calc(100dvh-9rem),700px)] xl:w-[350px] xl:max-w-[350px] xl:gap-3.5 xl:p-5 xl:pt-4';

  return (
    <>
      {showVoidGif && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.3)] border border-ruby/30 text-center max-w-sm w-[90%]">
            <img src={blehMochiGif} alt="Void Roll" className="mx-auto rounded-2xl shadow-lg border border-white/10" />
            <p className="font-display text-gold text-3xl font-bold tracking-widest mt-6 drop-shadow-md">{t('voidRollTitle')}</p>
            <p className="font-sans text-white/70 mt-3 text-sm leading-relaxed">
              {t('voidRollDescPart1')}<strong className="text-ruby drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">{t('voidRuleStrong')}</strong>{t('voidRollDescPart2')}
            </p>
            {isBotPlaying ? (
              <div className="mt-8 w-full py-3 bg-ruby/30 text-white/80 font-sans font-bold text-lg rounded-xl border border-ruby/50 animate-pulse">
                {t('autoSkipping')}
              </div>
            ) : (
              <button 
                onClick={() => {
                  setShowVoidGif(false);
                  dispatch({ type: ACTION_TYPES.END_TURN });
                  setLastRoll({ d1: null, d2: null });
                }} 
                className="mt-8 w-full py-3 bg-ruby/90 text-white font-sans font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-ruby hover:scale-[1.03] transition-all"
              >
                {t('acceptFate')}
              </button>
            )}
          </div>
        </div>
      )}
      <div className={trayShellClass} style={layoutMode === 'mobile' ? { height: MOBILE_TRAY_HEIGHT } : undefined}>
        <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l border-t border-gold/70"></span>
        <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r border-t border-gold/70"></span>
        <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b border-l border-gold/70"></span>
        <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b border-r border-gold/70"></span>
        {isStuckUI && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl">
            <div className="bg-ruby text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.6)] flex flex-col items-center border border-white/20 animate-pulse">
              <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest text-center">{t('noValidMoves')}</span>
              <span className="font-sans text-xs sm:text-sm font-semibold opacity-80 mt-1 uppercase tracking-wider">{t('skippingTurn')}</span>
            </div>
          </div>
        )}
        <div className={`${layoutMode === 'mobile' ? 'grid w-full grid-cols-[minmax(0,1fr)_minmax(124px,148px)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(164px,208px)]' : isCompactLandscapeTray ? 'flex w-full flex-none flex-col items-center gap-2' : 'flex w-full min-h-0 flex-row items-center justify-between gap-4 lg:flex-none lg:flex-col lg:justify-start lg:gap-3'}`}>
          <div className={`${layoutMode === 'mobile' ? 'flex min-w-0 flex-col items-start rounded-2xl border border-gold/20 bg-black/28 px-3 py-2 shadow-[inset_0_0_18px_rgba(0,0,0,0.45)]' : isCompactLandscapeTray ? 'flex w-full flex-col items-center' : 'flex flex-col items-start lg:w-full lg:items-center'}`}>
            <span className="mb-1 font-display text-xs uppercase tracking-[0.28em] text-white/65 lg:text-sm">{t('active')}</span>
            <div className={`${layoutMode === 'mobile' ? 'flex w-full min-w-0 flex-wrap items-center gap-2' : ''}`}>
              <div className={`min-w-0 truncate font-display text-lg font-bold uppercase leading-none text-gold text-glow-gold sm:text-2xl lg:text-[2.2rem] ${layoutMode === 'mobile' ? 'flex-1' : 'w-full max-w-full text-center'}`}>
                {state.players[state.currentPlayer]?.name || state.currentPlayer}
              </div>
              {layoutMode === 'mobile' && isCurrentUserPlayer && (
                <span className="rounded-md border border-ruby/30 bg-ruby/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  {t('you', 'YOU')}
                </span>
              )}
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
            <div className={`${layoutMode === 'mobile' ? 'mt-2 grid w-full max-w-[7rem] grid-cols-4 gap-1 rounded-lg border border-gold/25 bg-black/34 p-1.5' : 'mt-3 hidden w-full items-center justify-center gap-3 text-gold/85 lg:flex'}`}>
              {layoutMode === 'mobile' ? (
                activePlayer?.pieces?.map((piecePosition, pieceIndex) => {
                  const isLocked = piecePosition === -1;
                  const canSpawnPieceFromTray = isLocked && isMyTurn && !isBotPlaying && hasValidSpawn && !isRollingPhaseActive && !isBoardAnimating;
                  return (
                    <PanelPiece
                      key={pieceIndex}
                      color={activePlayer?.color}
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
                  <CrownIcon className="h-6 w-6 drop-shadow-[0_0_10px_rgba(234,179,8,0.65)]" aria-hidden="true" />
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
              className={`relative flex flex-col items-center rounded-2xl border px-2 py-2 transition-all ${activeRollHighlightClass} ${canTriggerRoll ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'} ${isAutoControlledTurn ? 'pointer-events-none opacity-90 grayscale-[0.2]' : ''} disabled:opacity-100`}
            >
              <TurnTimerOutline progress={turnTimerProgress} isCritical={isTimerCritical} isActive={canTriggerRoll} />
              <span className={`mb-1.5 font-display text-[10px] font-bold uppercase tracking-[0.22em] ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-white/70'}`}>{t('currentDice', 'Current Dice')}</span>
              <div className="flex gap-2 sm:gap-4 lg:gap-4">
                <Die value={lastRoll.d1 || '-'} isRolling={isRolling} compact isHighlighted={canTriggerRoll} />
                <Die value={lastRoll.d2 || '-'} isRolling={isRolling} compact isHighlighted={canTriggerRoll} />
              </div>
              <span className={`mt-1.5 text-center text-[10px] font-bold uppercase tracking-[0.18em] ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-white/60'}`}>
                {canTriggerRoll ? t('tapDiceToRoll', 'Tap dice to roll') : (isRolling ? t('rolling') : t('currentDice', 'Current Dice'))}
              </span>
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
              className={`relative flex flex-col items-center transition-all ${isCompactLandscapeTray ? 'w-full shrink-0 rounded-xl border px-3 py-2' : 'lg:w-full lg:shrink-0 lg:rounded-2xl lg:border lg:px-4 lg:py-3'} ${canTriggerRoll ? 'cursor-pointer border-gold/80 bg-gold/10 shadow-[0_0_38px_rgba(251,191,36,0.55),inset_0_0_30px_rgba(234,179,8,0.16)] ring-2 ring-gold/30 hover:border-gold hover:bg-gold/20 active:scale-[0.99]' : 'cursor-default border-white/15 bg-black/30 grayscale-[0.18] lg:shadow-[inset_0_0_22px_rgba(0,0,0,0.6)]'} ${isAutoControlledTurn ? 'pointer-events-none opacity-90 grayscale-[0.2]' : ''} disabled:opacity-100`}
            >
              <TurnTimerOutline progress={turnTimerProgress} isCritical={isTimerCritical} isActive={canTriggerRoll} />
              <span className={`mb-2 font-display text-sm font-bold uppercase tracking-widest ${isCompactLandscapeTray ? 'block text-[0.8rem]' : 'hidden lg:block lg:text-[0.95rem]'} ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-white/70'}`}>{t('currentDice', 'Current Dice')}</span>
              <div className="flex gap-2 sm:gap-4 lg:gap-4">
                <Die value={lastRoll.d1 || '-'} isRolling={isRolling} compact={layoutMode === 'mobile' || isCompactLandscapeTray} isHighlighted={canTriggerRoll} />
                <Die value={lastRoll.d2 || '-'} isRolling={isRolling} compact={layoutMode === 'mobile' || isCompactLandscapeTray} isHighlighted={canTriggerRoll} />
              </div>
              <span className={`mt-2 text-center font-sans text-[0.72rem] font-bold uppercase tracking-[0.18em] ${isCompactLandscapeTray ? 'block text-[0.62rem]' : 'hidden lg:block'} ${canTriggerRoll ? 'text-gold text-glow-gold' : 'text-white/60'}`}>
                {canTriggerRoll ? t('rollDice') : (isRolling ? t('rolling') : t('currentDice', 'Current Dice'))}
              </span>
            </button>
          )}
        </div>

        <div className={`${layoutMode === 'mobile' ? 'mt-0.5 w-full min-w-0' : isCompactLandscapeTray ? 'w-full min-h-0 flex-1' : 'w-full min-h-0 lg:h-[8.75rem] lg:flex-none xl:h-[9.25rem]'}`}>
          <div className={`relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gold/35 bg-black/45 p-2 sm:min-h-[64px] sm:p-3 lg:h-full lg:min-h-0 lg:w-full lg:rounded-2xl lg:bg-black/38 lg:px-4 lg:py-2 ${layoutMode === 'mobile' ? 'min-h-[4.6rem] w-full rounded-2xl bg-black/34 px-2.5 py-2 items-stretch justify-start' : isCompactLandscapeTray ? 'h-full w-full min-h-0 bg-black/38 px-3 py-2' : ''}`}>
            {layoutMode === 'mobile' ? (
              <div className="mb-1 flex w-full items-center justify-between gap-2">
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-gold/80">{t('queue')}</span>
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-gold/25 bg-black/35 px-1.5 text-[10px] font-bold leading-none text-white/70">
                  {state.turnQueue.length}
                </span>
              </div>
            ) : isCompactLandscapeTray ? (
              <span className="mb-1 font-display text-[0.65rem] uppercase tracking-[0.18em] text-gold/80">{t('queue')}</span>
            ) : (
              <span className="mb-1 hidden text-[8px] uppercase tracking-widest text-white/50 sm:block sm:text-[10px] lg:mb-2 lg:block lg:font-display lg:text-xs lg:text-gold/80">{t('queue')}</span>
            )}
            <div className={`${layoutMode === 'mobile' ? 'flex min-h-[2.25rem] w-full items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden' : 'flex min-h-0 flex-1 w-full flex-wrap items-center justify-center gap-1 overflow-y-auto pr-1 [scrollbar-width:none] sm:gap-2 lg:gap-2.5 [&::-webkit-scrollbar]:hidden'}`}>
            {state.turnQueue.length > 0 ? (
              state.turnQueue.map((roll, i) => {
                const rollText = roll.d2 == null ? roll.d1 : `${roll.d1} + ${roll.d2}`;
                return (
                  <span
                    key={i}
                    className={`font-bold px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm ${layoutMode === 'mobile' ? `snap-start shrink-0 rounded-xl border px-3 py-1.5 text-center ${i === 0 ? 'min-w-[5.5rem] bg-gold text-charcoal shadow-[0_0_14px_rgba(251,191,36,0.42)]' : 'min-w-[4.2rem] border-white/10 bg-white/10 text-white/75'}` : ''} ${layoutMode !== 'mobile' ? (i === 0 ? 'bg-gold text-charcoal shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-white/10 text-white/70 border border-white/10') : ''}`}
                  >
                    <span className="block whitespace-nowrap">{rollText}</span>
                  </span>
                );
              })
            ) : (
              <span className={`text-white/75 text-[10px] sm:text-xs italic ${layoutMode === 'mobile' ? 'flex w-full items-center justify-center rounded-xl border border-dashed border-gold/20 bg-black/25 py-1.5 text-center not-italic' : ''}`}>{t('empty')}</span>
            )}
            </div>
            {layoutMode !== 'mobile' && state.turnQueue.length > 8 && (
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

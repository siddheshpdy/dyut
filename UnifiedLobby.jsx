import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref as rtdbRef, onValue, set as rtdbSet, update as rtdbUpdate, get as rtdbGet, remove as rtdbRemove } from 'firebase/database';
import { db, rtdb, signInWithGoogle, logoutUser, updateUserName } from './firebaseSetup.js';
import { findRandomPublicGame } from './matchmaking.js';
import { DYUT_ICONS } from './dyut-icons';
import { dispatchMuteState, getEffectiveMuteState, toggleUserMutePreference } from './audio';
import { getAdsConfig, requestRewardedAd } from './adProvider';
import { parseCrazyGamesStoredValue, serializeCrazyGamesStoredValue } from './crazyGamesData';
import { useEconomy } from './EconomyContext';
import {
  DAILY_LOGIN_REWARD_COINS,
  MATCH_FEE_BPS,
  PUBLIC_MATCH_ENTRY_COINS,
  requiresPublicMatchEntry,
} from './economy';
import { PIECE_SKINS, normalizePieceSkinId } from './pieceSkins';

const ALL_COLORS = [
  { name: 'ruby', tw: 'bg-ruby' },
  { name: 'sapphire', tw: 'bg-sapphire' },
  { name: 'emerald', tw: 'bg-emerald' },
  { name: 'amber', tw: 'bg-amber' },
];

const IS_PORTAL = import.meta.env.VITE_CRAZYGAMES_BUILD === 'true';
const { enabled: ADS_ENABLED } = getAdsConfig();
const INSTANT_MULTIPLAYER_CONFIG = {
  matchType: 'ffa',
  isQuickGame: false,
  isVoidRuleEnabled: false,
  botDifficulty: 'easy'
};
const getPublicEconomyMetadata = (matchType) => ({
  entryPerPlayer: PUBLIC_MATCH_ENTRY_COINS,
  matchFeeBps: MATCH_FEE_BPS,
  prizeSplit: matchType === '2v2' ? 'equal_winning_humans' : 'winner_take_pool',
  winnerEligibility: 'paid_humans',
});

const OrnateDivider = () => (
  <div className="flex shrink-0 items-center justify-center gap-3 text-gold/60">
    <span className="h-px w-16 bg-gradient-to-r from-transparent via-gold/70 to-gold/20"></span>
    <span className="h-2 w-2 rotate-45 border border-gold/70"></span>
    <span className="h-px w-16 bg-gradient-to-l from-transparent via-gold/70 to-gold/20"></span>
  </div>
);

const LobbyModeCard = ({ tone, icon, title, description, onClick, disabled = false }) => {
  const toneStyles = {
    gold: {
      text: 'text-gold',
      border: 'border-gold/55',
      glow: 'shadow-[0_0_28px_rgba(234,179,8,0.18)]',
      wash: 'from-gold/20 via-gold/10 to-transparent',
      icon: 'border-gold/60 bg-gold/15 text-gold shadow-[0_0_22px_rgba(234,179,8,0.22)]',
    },
    ruby: {
      text: 'text-ruby',
      border: 'border-ruby/55',
      glow: 'shadow-[0_0_28px_rgba(220,38,38,0.16)]',
      wash: 'from-ruby/20 via-ruby/10 to-transparent',
      icon: 'border-ruby/60 bg-ruby/15 text-ruby shadow-[0_0_22px_rgba(220,38,38,0.22)]',
    },
    sapphire: {
      text: 'text-sapphire',
      border: 'border-sapphire/55',
      glow: 'shadow-[0_0_28px_rgba(56,189,248,0.14)]',
      wash: 'from-sapphire/20 via-sapphire/10 to-transparent',
      icon: 'border-sapphire/60 bg-sapphire/15 text-sapphire shadow-[0_0_22px_rgba(56,189,248,0.2)]',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex min-h-[clamp(4.8rem,13dvh,6.6rem)] w-full items-center gap-[clamp(0.6rem,1.25vw,0.9rem)] overflow-hidden rounded-[clamp(0.9rem,1.5vw,1.125rem)] border bg-black/45 p-[clamp(0.5rem,1.2vw,0.85rem)] text-left transition-all duration-300 ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 hover:bg-black/65'} ${toneStyles.border} ${toneStyles.glow}`}
    >
      <div className={`absolute inset-0 rounded-[18px] bg-gradient-to-r ${toneStyles.wash} opacity-80 transition-opacity group-hover:opacity-100`}></div>
      <div className="absolute inset-y-[12%] right-[8%] hidden w-[22%] rounded bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.13),transparent_62%)] opacity-35 sm:block"></div>
      <div className={`relative z-10 flex h-[clamp(2.75rem,6vw,4rem)] w-[clamp(2.75rem,6vw,4rem)] shrink-0 items-center justify-center rounded-full border text-[clamp(1.25rem,2.8vw,2rem)] [&_svg]:h-[clamp(1.5rem,2.6vw,2rem)] [&_svg]:w-[clamp(1.5rem,2.6vw,2rem)] ${toneStyles.icon}`}>
        {icon}
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <div className={`font-display text-[clamp(1rem,2.5vw,1.55rem)] font-bold uppercase leading-[1.05] tracking-[0.08em] ${toneStyles.text}`}>{title}</div>
        <p className="mt-[clamp(0.1rem,0.35dvh,0.25rem)] text-[clamp(0.72rem,1.35vw,0.9rem)] leading-snug text-white/70">{description}</p>
      </div>
      <div className={`relative z-10 pr-[clamp(0.1rem,0.45vw,0.35rem)] font-display text-[clamp(1.5rem,3vw,2rem)] transition-transform group-hover:translate-x-1 ${toneStyles.text}`}>{'>'}</div>
    </button>
  );
};

const ConfigSectionTitle = ({ children }) => (
  <div className="lobby-config-section-title flex w-full items-center justify-center gap-3 text-[#f6dda4] lg:gap-2">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold/70"></span>
    <span className="h-1.5 w-1.5 rotate-45 border border-gold/70 lg:h-1 lg:w-1"></span>
    <span className="font-display text-xs font-bold uppercase tracking-[0.22em] sm:text-sm lg:text-[0.68rem]">{children}</span>
    <span className="h-1.5 w-1.5 rotate-45 border border-gold/70 lg:h-1 lg:w-1"></span>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold/70"></span>
  </div>
);

const ConfigChoiceCard = ({ active, tone = 'gold', icon, title, subtitle, children, onClick, disabled = false, className = '' }) => {
  const toneClasses = {
    gold: active
      ? 'border-gold bg-gold/30 text-[#fff4c7] shadow-[0_0_28px_rgba(234,179,8,0.32),inset_0_0_34px_rgba(234,179,8,0.14)]'
      : 'border-gold/50 bg-[#15110c]/90 text-[#f2e7ca] hover:border-gold/80 hover:text-white',
    sapphire: active
      ? 'border-sapphire bg-sapphire/30 text-[#dff4ff] shadow-[0_0_28px_rgba(56,189,248,0.32),inset_0_0_34px_rgba(56,189,248,0.14)]'
      : 'border-sapphire/50 bg-[#0c1317]/90 text-[#dff4ff] hover:border-sapphire/80 hover:text-white',
    emerald: active
      ? 'border-emerald bg-emerald/30 text-[#dcfce7] shadow-[0_0_28px_rgba(52,211,153,0.3),inset_0_0_34px_rgba(52,211,153,0.13)]'
      : 'border-emerald/50 bg-[#0b1510]/90 text-[#dcfce7] hover:border-emerald/80 hover:text-white',
    ruby: active
      ? 'border-ruby bg-ruby/30 text-[#ffe4e6] shadow-[0_0_28px_rgba(244,63,94,0.32),inset_0_0_34px_rgba(244,63,94,0.14)]'
      : 'border-ruby/50 bg-[#170d10]/90 text-[#ffe4e6] hover:border-ruby/80 hover:text-white',
    violet: active
      ? 'border-purple-300 bg-purple-500/30 text-[#f3e8ff] shadow-[0_0_28px_rgba(168,85,247,0.3),inset_0_0_34px_rgba(168,85,247,0.13)]'
      : 'border-purple-400/50 bg-[#140f18]/90 text-[#f3e8ff] hover:border-purple-300/80 hover:text-white',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      data-selected={active ? 'true' : 'false'}
      className={`lobby-config-card group relative overflow-hidden rounded-2xl border p-3 text-center transition-all duration-300 sm:p-4 lg:p-2.5 ${active ? 'z-10 ring-2 ring-[#fff4c7] ring-offset-2 ring-offset-[#120f0c]' : ''} ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5'} ${toneClasses} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.12),transparent_38%)] opacity-70"></div>
      {active && (
        <span className="lobby-config-selected-badge absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white/80 bg-[#fff4c7] font-sans text-xs font-black leading-none text-[#17120b] shadow-[0_0_12px_rgba(255,244,199,0.65)]" aria-hidden="true">
          ✓
        </span>
      )}
      <div className="lobby-config-card-content relative z-10 flex h-full flex-col items-center justify-center gap-1.5 lg:gap-1 [&_svg]:lg:h-5 [&_svg]:lg:w-5">
        <div className="lobby-config-card-extra contents">{children}</div>
        {icon && (
          <span className={`lobby-config-card-icon mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-current/40 bg-black/25 sm:h-11 sm:w-11 lg:mt-0.5 lg:h-7 lg:w-7 ${active ? 'opacity-100' : 'opacity-80'}`}>
            {icon}
          </span>
        )}
        <div className="lobby-config-card-title font-display text-lg font-bold uppercase tracking-wider sm:text-xl lg:text-[0.95rem]">{title}</div>
        {subtitle && <div className="lobby-config-card-subtitle hidden text-xs leading-snug text-[#d8d1c7] sm:block sm:text-sm lg:text-[0.7rem] lg:leading-tight">{subtitle}</div>}
      </div>
    </button>
  );
};

const EconomySummary = ({ compact = false }) => {
  const {
    balance,
    status,
    dailyReward,
    dailyRewardAvailable,
    isClaimingDailyReward,
    claimDailyReward,
    goals = [],
    claimGoalReward,
    claimRewardMultiplier,
  } = useEconomy();
  const { t } = useTranslation();
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [pendingMultiplier, setPendingMultiplier] = useState(null);
  const [isWatchingRewardAd, setIsWatchingRewardAd] = useState(false);
  const [multiplierResult, setMultiplierResult] = useState(null);
  const RewardsIcon = DYUT_ICONS.rewards;
  const CloseIcon = DYUT_ICONS.close;
  const multiplierOfferEnabled = ADS_ENABLED;

  const claimRewardAndOfferMultiplier = async (claimOperation, label) => {
    setClaimError(null);
    try {
      const result = await claimOperation();
      if (result?.applied && multiplierOfferEnabled) {
        setPendingMultiplier({ sourceEventId: result.eventId, amount: result.event.delta, label });
      }
      return result;
    } catch {
      setClaimError(t('rewardClaimError', 'Could not claim this reward. Please try again.'));
      return null;
    }
  };

  const handleClaimDailyReward = () => claimRewardAndOfferMultiplier(claimDailyReward, 'daily');

  const handleClaimGoal = (goalId) => () => (
    claimRewardAndOfferMultiplier(() => claimGoalReward({ goalId }), goalId)
  );

  const handleRewardMultiplier = async () => {
    if (!pendingMultiplier) return;
    setIsWatchingRewardAd(true);
    setClaimError(null);
    try {
      await requestRewardedAd({
        adStarted: () => window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: true })),
        adFinished: () => dispatchMuteState(),
      });
      const result = await claimRewardMultiplier({ sourceEventId: pendingMultiplier.sourceEventId, multiplier: 2 });
      if (result?.applied) {
        setMultiplierResult({ amount: result.event.delta });
        setPendingMultiplier(null);
      }
    } catch {
      setClaimError(t('rewardAdError', 'The ad was not completed. Your base reward is safe.'));
    } finally {
      setIsWatchingRewardAd(false);
    }
  };

  return (
    <>
      <div
        data-testid="coin-balance"
        className={`flex items-center gap-1.5 rounded-full border border-gold/40 bg-black/65 font-bold text-gold shadow-[0_0_18px_rgba(234,179,8,0.16)] ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs sm:text-sm'}`}
        title={t('templeCoins', 'Temple Coins')}
      >
        <span aria-hidden="true" className="text-amber">◆</span>
        <span>{status === 'loading' ? '…' : balance.toLocaleString()}</span>
      </div>
      <button
        type="button"
        data-testid="daily-reward-button"
        onClick={() => setIsRewardsOpen(true)}
        aria-label={t('rewards', 'Rewards')}
        title={t('rewards', 'Rewards')}
        className={`relative flex items-center justify-center rounded-full border transition-colors ${compact ? 'h-7 w-7' : 'h-8 w-8'} ${dailyRewardAvailable ? 'border-emerald/60 bg-emerald/15 text-emerald shadow-[0_0_18px_rgba(52,211,153,0.22)] hover:bg-emerald/25' : 'border-white/15 bg-black/55 text-white/65 hover:border-gold/45 hover:text-gold'}`}
      >
        <RewardsIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        {dailyRewardAvailable && (
          <span
            data-testid="daily-reward-available"
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#07130d] bg-emerald shadow-[0_0_8px_rgba(52,211,153,0.9)]"
          />
        )}
      </button>
      {isRewardsOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setIsRewardsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-reward-dialog-title"
            data-testid="daily-reward-dialog"
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-[min(88dvh,48rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold/40 bg-[#100e0c]/98 p-5 text-left shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_28px_rgba(234,179,8,0.06)]"
          >
            <button
              type="button"
              onClick={() => setIsRewardsOpen(false)}
              aria-label={t('close', 'Close')}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/65 hover:border-gold/45 hover:text-gold"
            >
              <CloseIcon className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/45 bg-gold/10 text-gold">
                <RewardsIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="daily-reward-dialog-title" className="font-display text-xl font-bold uppercase tracking-wider text-gold">
                  {t('dailyRewardTitle', 'Daily Reward')}
                </h2>
                <p className="mt-1 text-xs text-white/75">
                  {t('dailyRewardDescription', 'Claim {{amount}} Temple Coins once per day.', { amount: DAILY_LOGIN_REWARD_COINS })}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-emerald/30 bg-emerald/8 p-4 text-center">
              <div className="text-2xl font-black text-emerald">+{DAILY_LOGIN_REWARD_COINS}</div>
              {dailyRewardAvailable ? (
                <button
                  type="button"
                  data-testid="daily-reward-claim"
                  onClick={handleClaimDailyReward}
                  disabled={isClaimingDailyReward}
                  className="mt-3 w-full rounded-lg border border-emerald/50 bg-emerald/18 px-4 py-2 text-sm font-bold uppercase tracking-wider text-[#dfffea] transition-colors hover:bg-emerald/28 disabled:cursor-wait disabled:opacity-65"
                >
                  {isClaimingDailyReward
                    ? t('claimingReward', 'Claiming…')
                    : t('claimReward', 'Claim Reward')}
                </button>
              ) : (
                <p role="status" data-testid="daily-reward-claimed" className="mt-2 text-sm font-bold text-emerald">
                  {dailyReward
                    ? t('dailyRewardGranted', 'Daily reward: +{{amount}} coins', { amount: dailyReward.amount })
                    : t('dailyRewardClaimed', 'Claimed today')}
                </p>
              )}
              {claimError && <p role="alert" className="mt-2 text-xs font-semibold text-ruby">{claimError}</p>}
            </div>

            <div className="mt-4 space-y-2" data-testid="reward-goals">
              <div className="font-display text-xs font-bold uppercase tracking-[0.24em] text-gold/80">
                {t('rewardGoals', 'Reward Goals')}
              </div>
              {goals.map((goal) => {
                const labels = {
                  'daily-win': t('dailyWinGoal', 'Win 1 online match'),
                  'daily-capture': t('dailyCaptureGoal', 'Capture 3 pieces'),
                  'weekly-win': t('weeklyWinGoal', 'Win 3 online matches'),
                  'weekly-capture': t('weeklyCaptureGoal', 'Capture 10 pieces'),
                };
                return (
                  <div key={`${goal.id}:${goal.periodKey}`} data-testid={`reward-goal-${goal.id}`} className="rounded-xl border border-white/12 bg-white/5 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white/90">{labels[goal.id]}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/55">
                          {goal.scope === 'daily' ? t('today', 'Today') : t('thisWeek', 'This week')} · +{goal.reward} coins
                        </div>
                      </div>
                      {goal.claimable ? (
                        <button type="button" data-testid={`reward-goal-claim-${goal.id}`} onClick={handleClaimGoal(goal.id)} className="shrink-0 rounded-lg border border-emerald/50 bg-emerald/18 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#dfffea] hover:bg-emerald/28">
                          {t('claim', 'Claim')}
                        </button>
                      ) : (
                        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${goal.claimed ? 'text-emerald' : 'text-white/55'}`}>
                          {goal.claimed ? t('claimed', 'Claimed') : `${goal.progress}/${goal.target}`}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/60">
                      <div className="h-full rounded-full bg-emerald transition-all" style={{ width: `${Math.round((goal.progress / goal.target) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {ADS_ENABLED && !multiplierOfferEnabled && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/12 bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-white/75">{t('watchAdForCoins', 'Watch ad for coins')}</div>
                  <div className="text-[11px] text-white/55">{t('rewardedAdsComingSoon', 'More rewards coming soon')}</div>
                </div>
                <button type="button" disabled className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  {t('comingSoon', 'Coming Soon')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {pendingMultiplier && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="reward-multiplier-title" data-testid="reward-multiplier-dialog" className="w-full max-w-sm rounded-2xl border border-emerald/45 bg-[#100e0c]/98 p-5 text-center shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            <h2 id="reward-multiplier-title" className="font-display text-xl font-bold uppercase tracking-wider text-emerald">
              {t('rewardMultiplierTitle', 'Boost your reward')}
            </h2>
            <p className="mt-2 text-sm text-white/75">{t('rewardMultiplierDescription', 'Watch a short ad to double this reward.')}</p>
            <div className="mt-4 text-3xl font-black text-gold">+{pendingMultiplier.amount} → +{pendingMultiplier.amount * 2}</div>
            <button type="button" data-testid="reward-multiplier-watch" onClick={handleRewardMultiplier} disabled={isWatchingRewardAd} className="mt-4 w-full rounded-lg border border-emerald/50 bg-emerald/18 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-[#dfffea] hover:bg-emerald/28 disabled:cursor-wait disabled:opacity-65">
              {isWatchingRewardAd ? t('watchingAd', 'Watching ad…') : t('watchAdDouble', 'Watch ad · 2x reward')}
            </button>
            <button type="button" data-testid="reward-multiplier-skip" onClick={() => setPendingMultiplier(null)} className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/65 hover:text-white">
              {t('keepBaseReward', 'Keep base reward')}
            </button>
            {claimError && <p role="alert" className="mt-2 text-xs font-semibold text-ruby">{claimError}</p>}
          </section>
        </div>
      )}
      {multiplierResult && (
        <div role="status" data-testid="reward-multiplier-result" className="fixed bottom-5 left-1/2 z-[180] -translate-x-1/2 rounded-full border border-emerald/50 bg-[#07130d]/95 px-4 py-2 text-sm font-bold text-emerald shadow-xl">
          {t('rewardMultiplierGranted', '+{{amount}} bonus coins', { amount: multiplierResult.amount })}
          <button type="button" aria-label={t('close', 'Close')} onClick={() => setMultiplierResult(null)} className="ml-2 text-white/60 hover:text-white">×</button>
        </div>
      )}
    </>
  );
};

const SeatCard = ({ id, label, seat, onTypeChange, onColorChange, onNameChange, onSkinChange, onClaim, activeColors, isHost, isOnline, userUid, t, hasClaimedSeat, lobbyStatus, isLobbyPublic }) => {
  const isActive = seat.type !== 'closed';
  const isBot = seat.type === 'bot';
  const typeColor = seat.type === 'human' ? 'text-[#fff4c7] bg-gold/10 border-gold/45' : seat.type === 'bot' ? 'text-[#dff4ff] bg-sapphire/10 border-sapphire/45' : 'text-white/65 bg-white/10 border-white/15';
  const DropdownIcon = DYUT_ICONS.dropdown;
  
  const isOwnedByMe = seat.uid === userUid;
  const editable = !isOnline || isOwnedByMe || (isBot && isHost);
  const isUnclaimedHuman = isOnline && seat.type === 'human' && !seat.uid;

  // Local state to prevent rapid keystrokes from causing Firebase race conditions
  const [localName, setLocalName] = useState(seat.name || '');

  // Sync local state when external data changes, but only when necessary
  useEffect(() => {
    setLocalName(seat.name || '');
  }, [seat.name]);

  const handleBlur = () => {
    if (localName !== seat.name) onNameChange(localName);
  };

  return (
  <div className={`lobby-seat-card flex flex-col items-center rounded-xl border p-3 transition-all lg:p-2.5 ${isActive ? (isOwnedByMe ? 'bg-black/60 border-gold shadow-[0_0_15px_rgba(251,191,36,0.4)] scale-[1.02]' : 'bg-black/50 border-white/15 shadow-[0_4px_12px_rgba(0,0,0,0.5)]') : 'border-white/10 bg-black/45 opacity-75 hover:opacity-90'}`}>
       <span className={`lobby-seat-label mb-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest lg:mb-1 lg:text-[8px] ${isOwnedByMe ? 'text-[#fff4c7] drop-shadow-md' : 'text-white/70'}`}>
        {label} {isOwnedByMe && <span className="opacity-80">({t('you', 'YOU')})</span>}
      </span>
      
      <div className="lobby-seat-type relative w-full">
        <select 
          aria-label={`Select type for ${label}`}
          value={seat.type} 
          onChange={(e) => onTypeChange(e.target.value)}
          disabled={(isOnline && !isHost) || isLobbyPublic}
          className={`w-full appearance-none rounded-lg border px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wider transition-colors outline-none lg:py-1 lg:text-[11px] ${(isOnline && !isHost) || isLobbyPublic ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${typeColor}`}
        >
          <option value="human" className="bg-charcoal text-gold">{t('human', 'Human')}</option>
          <option value="bot" className="bg-charcoal text-sapphire">{t('bot', 'Bot')}</option>
          <option value="closed" className="bg-charcoal text-white/70">{t('closed', 'Closed')}</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center px-1">
          <DropdownIcon className={`h-3 w-3 ${seat.type === 'closed' ? 'text-white/65' : seat.type === 'human' ? 'text-[#fff4c7]' : 'text-[#dff4ff]'}`} aria-hidden="true" />
        </div>
      </div>
      
      {isUnclaimedHuman ? (
        <div className="mt-2 w-full rounded border border-dashed border-white/25 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-white/70 animate-pulse">
          {t('waiting', 'WAITING...')}
        </div>
      ) : (
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleBlur}
          disabled={!editable}
          placeholder={t('playerNamePlaceholder', 'Enter Name')}
          maxLength={12}
          spellCheck="false"
          className={`lobby-seat-name mt-2 w-full rounded border border-white/10 bg-transparent py-1 text-center font-sans text-xs text-white/90 transition-opacity focus:outline-none focus:border-gold/50 lg:mt-1.5 lg:text-[11px] ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      )}

      <select
        aria-label={t('pieceDesignForPlayer', 'Piece design for {{player}}', { player: label })}
        value={normalizePieceSkinId(seat.pieceSkinId)}
        onChange={(event) => onSkinChange(event.target.value)}
        disabled={!editable || !isActive || isUnclaimedHuman}
        className={`mt-1.5 w-full rounded border border-gold/35 bg-black/55 px-1 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-[#fff4c7] outline-none lg:text-[8px] ${!editable || !isActive || isUnclaimedHuman ? 'cursor-not-allowed opacity-65' : 'cursor-pointer hover:border-gold/65'}`}
      >
        {PIECE_SKINS.map((skin) => (
          <option key={skin.id} value={skin.id} className="bg-charcoal text-gold">
            {t(skin.nameKey, skin.fallbackName)}
          </option>
        ))}
      </select>

      <div className={`lobby-seat-colors mt-3 flex gap-1.5 transition-opacity lg:mt-2 ${isActive && !isUnclaimedHuman ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {ALL_COLORS.map(color => {
          const isTaken = activeColors.includes(color.name) && seat.color !== color.name;
          return (
            <button
              key={color.name}
              disabled={!editable || isTaken}
              onClick={() => !isTaken && onColorChange(color.name)}
              className={`h-5 w-5 rounded-full ${color.tw} jewel-shadow transition-all lg:h-4 lg:w-4 ${seat.color === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-charcoal scale-125 z-10' : isTaken ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
              title={color.name}
            />
          );
        })}
      </div>

      {isOnline && !seat.uid && !hasClaimedSeat && lobbyStatus === 'waiting' && !isLobbyPublic && seat.type !== 'closed' && (
        <button onClick={() => onClaim(id)} className="w-full mt-2 py-1 bg-emerald/20 text-emerald border border-emerald/30 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-emerald/30 transition-colors">
          {t('claimSeat', 'Claim Seat')}
        </button>
      )}
      {isOnline && seat.type === 'human' && seat.uid && !isOwnedByMe && (
        <div className="w-full mt-2 py-1 bg-ruby/20 text-ruby border border-ruby/30 rounded text-[10px] uppercase font-bold tracking-widest text-center cursor-not-allowed">
          {t('taken', 'Taken')}
        </div>
      )}
    </div>
  );
};

const PlayerProfile = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [cgUser, setCgUser] = useState(null);
  const { t } = useTranslation();
  const ExitIcon = DYUT_ICONS.exit;

  useEffect(() => {
    if (IS_PORTAL) {
      let authListener = null;

      const fetchPortalStats = async () => {
        if (window.CrazyGames?.SDK) {
          try {
            if (window.cgInitPromise) await window.cgInitPromise;
            try {
              const systemUser = await window.CrazyGames.SDK.user.getUser();
              if (systemUser) setCgUser(systemUser);

              // Listen for users signing in from the portal's native top-bar (outside the iframe)
              authListener = (sysUser) => {
                if (sysUser) setCgUser(sysUser);
              };
              window.CrazyGames.SDK.user.addAuthListener(authListener);
            } catch (e) { console.error("CrazyGames user error:", e); }

            const storedData = await window.CrazyGames.SDK.data.getItem('dyut_stats');
            const data = parseCrazyGamesStoredValue(storedData);
            if (data) setStats(data);
          } catch (e) { console.error(e); }
        }
      };
      const fetchPortalStatsTimeout = setTimeout(fetchPortalStats, 500); // Give SDK time to init
      return () => {
        clearTimeout(fetchPortalStatsTimeout);
        if (authListener && window.CrazyGames?.SDK?.user?.removeAuthListener) {
          try { window.CrazyGames.SDK.user.removeAuthListener(authListener); } catch(e) {}
        }
      };
    }

    if (user && !user.isAnonymous) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setStats(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [user]);

  if (!user && !IS_PORTAL) return <div className="h-10"></div>;

  if (IS_PORTAL && !cgUser) {
    const handleCgSignIn = async () => {
      if (!window.CrazyGames?.SDK) return;
      setIsSigningIn(true);
      try {
        const systemUser = await window.CrazyGames.SDK.user.showAuthPrompt();
        if (systemUser) setCgUser(systemUser);
      } catch (e) { console.error("CrazyGames Auth error:", e); }
      setIsSigningIn(false);
    };

    return (
      <button type="button" onClick={handleCgSignIn} disabled={isSigningIn} className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 bg-white/5 transition-colors border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full z-20 shadow-sm animate-fade-in ${isSigningIn ? 'opacity-70 cursor-wait' : 'hover:bg-white/10'}`}>
        {isSigningIn ? (
          <svg className="animate-spin w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        )}
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{isSigningIn ? t('signingIn', 'Signing In...') : t('signInCrazyGames', 'Log in to save')}</span>
      </button>
    );
  } else if (user?.isAnonymous && !IS_PORTAL) {
    const handleSignIn = () => {
      setIsSigningIn(true);
      signInWithGoogle().finally(() => {
        setIsSigningIn(false);
      });
    };

    return (
      <button type="button" onClick={handleSignIn} disabled={isSigningIn} className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 bg-white/5 transition-colors border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full z-20 shadow-sm animate-fade-in ${isSigningIn ? 'opacity-70 cursor-wait' : 'hover:bg-white/10'}`}>
        {isSigningIn ? (
          <svg className="animate-spin w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{isSigningIn ? t('signingIn', 'Signing In...') : t('signInGoogle', 'Sign in to save stats')}</span>
      </button>
    );
  }

  const displayName = cgUser?.username || stats?.displayName || user?.displayName || (IS_PORTAL ? 'Portal Player' : 'Player');
  const photoURL = cgUser?.profilePictureUrl || user?.photoURL || stats?.photoURL;

  const handleEditSave = async () => {
    if (editName.trim() && editName.trim() !== displayName) {
      if (IS_PORTAL) {
        const newStats = { ...stats, displayName: editName.trim() };
        setStats(newStats);
        if (window.CrazyGames?.SDK) {
          const saveStats = async () => {
            if (window.cgInitPromise) await window.cgInitPromise;
            await window.CrazyGames.SDK.data.setItem('dyut_stats', serializeCrazyGamesStoredValue(newStats));
          };
          saveStats().catch(console.error);
        }
      } else {
        await updateUserName(editName.trim());
      }
    }
    setIsEditing(false);
  };
  
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className="h-9 sm:h-10 flex items-center justify-between gap-2 sm:gap-4 bg-black/20 border border-white/5 pl-3 pr-2 sm:pl-4 sm:pr-3 py-1.5 sm:py-2 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] animate-fade-in">
      <div className="flex items-center gap-2 sm:gap-3">
        {photoURL ? (
          <img src={photoURL} alt="Profile" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/20 shadow-md object-cover" />
        ) : (
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gold flex items-center justify-center text-charcoal font-bold text-xs sm:text-sm shadow-md">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          {isEditing ? (
            <input 
              type="text" 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)} 
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSave}
              autoFocus
              maxLength={15}
              className="w-24 bg-black/40 border border-gold/50 rounded px-1 py-0.5 text-xs font-bold text-white/90 focus:outline-none"
            />
          ) : (
            <div className={`flex items-center gap-1.5 ${cgUser ? '' : 'group cursor-pointer'}`} onClick={() => { if (!cgUser) { setEditName(displayName); setIsEditing(true); } }} title={cgUser ? '' : t('editName', 'Edit Name')}>
              <span className="text-[10px] sm:text-xs font-bold text-white/90 leading-none truncate max-w-[80px] sm:max-w-[120px]">{displayName}</span>
              {!cgUser && (
                <svg className="w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
          )}
          {stats && (
            <span className="text-[10px] font-bold text-gold tracking-widest mt-1.5 leading-none drop-shadow-md">
              {stats.wins}W / {stats.gamesPlayed}P
            </span>
          )}
        </div>
      </div>
      {!IS_PORTAL && (
        <button 
          onClick={logoutUser} 
          className="text-white/30 hover:text-ruby transition-colors ml-1 p-1.5 rounded-full hover:bg-white/5"
          title={t('signOut', 'Sign Out')}
        >
          <ExitIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

const UnifiedLobby = ({ onStartGame, onResumeGame, onClearOfflineResume, onShowRules, onShowTutorial, onShowHistory, onShowAbout, hasCachedGame, resumeOnlineGameId = null, joinGameId, user, autoStartPortalIntro = false, onPortalAutoStartConsumed = null, autoStartInstantMultiplayer = false, onInstantMultiplayerConsumed = null, autoStartPlayWithFriendsConfig = null, onPlayWithFriendsAutoStartConsumed = null, onReconnectOnline, qaShowOfflineResume = false }) => {
  const [seats, setSeats] = useState({
    Player4: { type: 'closed', color: 'amber', name: '', uid: null },
    Player3: { type: 'closed', color: 'emerald', name: '', uid: null },
    Player1: { type: 'human', color: 'ruby', name: '', uid: null },
    Player2: { type: 'bot', color: 'sapphire', name: '', uid: null }
  });
  const [botDifficulty, setBotDifficulty] = useState('hard');
  const [isVoidRuleEnabled, setIsVoidRuleEnabled] = useState(() => !IS_PORTAL);
  const [isQuickGame, setIsQuickGame] = useState(false);
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [pendingGameId, setPendingGameId] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isHosting, setIsHosting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLobbyPublic, setIsLobbyPublic] = useState(false);
  const [setupMode, setSetupMode] = useState(null);
  const [setupStep, setSetupStep] = useState('config');
  const [matchType, setMatchType] = useState('1v1');
  const [lobbyStatus, setLobbyStatus] = useState('waiting');
  const [lobbyHostUid, setLobbyHostUid] = useState(null);
  const [lobbyExpiresAt, setLobbyExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('waiting');
  const [hostLastPing, setHostLastPing] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => getEffectiveMuteState());
  const [portalUser, setPortalUser] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [offlineResumeAction, setOfflineResumeAction] = useState(() => (qaShowOfflineResume ? () => {} : null));
  const [economyNotice, setEconomyNotice] = useState(null);

  const { t } = useTranslation();
  const {
    balance,
    status: economyStatus,
    reservePublicEntry,
  } = useEconomy();
  const startingGameIdsRef = useRef(new Set());
  const canAffordPublicMatch = balance >= PUBLIC_MATCH_ENTRY_COINS;

  const toggleMute = () => {
    setIsMuted(toggleUserMutePreference());
  };

  const activeLobbyId = joinGameId || pendingGameId;
  const isHost = (activeLobbyId && pendingGameId !== null) || (user && lobbyHostUid === user.uid);
  const hasClaimedSeat = Object.values(seats).some(s => s.uid === user?.uid);
  const localPlayerName = portalUser?.username || user?.displayName || '';

  const activeSeats = Object.entries(seats).filter(([_, s]) => s.type !== 'closed');
  const playerCount = activeSeats.length;
  const botCount = activeSeats.filter(([_, s]) => s.type === 'bot').length;
  const activeColors = activeSeats.map(([_, s]) => s.color);

  useEffect(() => {
    const handleMuteChange = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handleMuteChange);
    return () => window.removeEventListener('dyut-mute-change', handleMuteChange);
  }, []);

  useEffect(() => {
    if (!IS_PORTAL) return undefined;

    let isMounted = true;
    let authListener = null;

    const loadPortalUser = async () => {
      if (!window.CrazyGames?.SDK) return;

      try {
        if (window.cgInitPromise) await window.cgInitPromise;
        if (!isMounted) return;

        const systemUser = await window.CrazyGames.SDK.user.getUser();
        if (isMounted) setPortalUser(systemUser || null);

        if (window.CrazyGames.SDK.user?.addAuthListener) {
          authListener = (systemUserUpdate) => {
            if (isMounted) setPortalUser(systemUserUpdate || null);
          };
          window.CrazyGames.SDK.user.addAuthListener(authListener);
        }
      } catch {
        if (isMounted) setPortalUser(null);
      }
    };

    loadPortalUser();

    return () => {
      isMounted = false;
      if (authListener && window.CrazyGames?.SDK?.user?.removeAuthListener) {
        try { window.CrazyGames.SDK.user.removeAuthListener(authListener); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    // Wait until the anonymous authentication completes before attempting to listen to the secure database
    if (!activeLobbyId || !user) return; 
    
    setConnectionStatus('connecting');

    const unsub = onValue(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), (snapshot) => {
      if (snapshot.exists()) {
        setConnectionStatus('connected');
        const data = snapshot.val();
        if (data.seats) setSeats(data.seats);
        if (data.botDifficulty !== undefined) setBotDifficulty(data.botDifficulty);
        if (data.isVoidRuleEnabled !== undefined) setIsVoidRuleEnabled(data.isVoidRuleEnabled);
        if (data.isQuickGame !== undefined) setIsQuickGame(data.isQuickGame);
        if (data.isTeamMode !== undefined) setIsTeamMode(data.isTeamMode);
        if (data.isPublic !== undefined) setIsLobbyPublic(data.isPublic);
        if (data.status !== undefined) setLobbyStatus(data.status);
        if (data.hostUid !== undefined) setLobbyHostUid(data.hostUid);
        if (data.expiresAt !== undefined) setLobbyExpiresAt(data.expiresAt);
        if (data.matchType !== undefined) setMatchType(data.matchType);
        if (data.lastPing !== undefined) setHostLastPing(data.lastPing);
        if (data.status === 'abandoned' && !isHost) {
          alert(t('hostOffline', 'The host has disconnected. Lobby closed.'));
          window.location.href = window.location.pathname;
        }

        // If the host starts the game, instantly pull joiners into the match
        if (data.gameStarted && joinGameId) {
          executeStart(true, activeLobbyId, data);
        }
      } else {
        setConnectionStatus('notFound');
      }
    }, (error) => {
      console.error("Lobby listener error:", error);
      setConnectionStatus('error: ' + error.message);
    });
    return () => unsub();
  }, [activeLobbyId, joinGameId, user]);

  useEffect(() => {
    if (!lobbyExpiresAt || !activeLobbyId || lobbyStatus !== 'waiting') {
      setTimeLeft(null);
      return;
    }
    
    const updateTimer = () => {
      const remaining = Math.floor((lobbyExpiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        return false;
      }
      setTimeLeft(remaining);
      return true;
    };

    if (updateTimer()) {
      const interval = setInterval(() => {
        if (!updateTimer()) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lobbyExpiresAt, activeLobbyId, lobbyStatus]);

  // Push room status updates to CrazyGames SDK for external invite link locking and portal UI
  const updateCrazyGamesRoom = async (action, targetSeats, roomId = activeLobbyId) => {
    if (IS_PORTAL && window.CrazyGames?.SDK && roomId) {
      try {
        if (window.cgInitPromise) await window.cgInitPromise;
        const humanSeats = Object.values(targetSeats).filter(s => s.type === 'human');
        const claimedSeats = humanSeats.filter(s => s.uid);
        const isFull = humanSeats.length > 0 && humanSeats.length === claimedSeats.length;
        
        if (typeof window.CrazyGames.SDK.game.updateRoom === 'function') {
          window.CrazyGames.SDK.game.updateRoom({
            roomId,
            action: action === 'start' || isFull ? 'start' : 'update',
            playerCount: claimedSeats.length,
            maxPlayerCount: humanSeats.length,
            isJoinable: action !== 'start' && !isFull,
            inviteParams: { roomId }
          });
        }
      } catch (e) { console.error("CrazyGames updateRoom error:", e); }
    }
  };

  const isStartingRef = useRef(false);

  useEffect(() => {
    if (!isHost || lobbyStatus !== 'waiting' || !isLobbyPublic) return;

    const humanSeats = Object.values(seats).filter(s => s.type === 'human');
    const claimedSeats = humanSeats.filter(s => s.uid);
    const isFull = humanSeats.length > 0 && humanSeats.length === claimedSeats.length;

    if (isFull || timeLeft === 0) {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      const autoStart = async () => {
        setLobbyStatus('playing'); // Prevent multiple triggers
        const finalSeats = { ...seats };
        Object.keys(finalSeats).forEach(k => {
          if (finalSeats[k].type === 'human' && !finalSeats[k].uid) {
            finalSeats[k] = { ...finalSeats[k], type: 'bot' };
          }
        });
        try {
          await rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), { status: 'playing', gameStarted: true, seats: finalSeats, openSeats: 0 });
          updateCrazyGamesRoom('start', finalSeats);
        } catch (e) {
          console.error("AutoStart sync error:", e);
        }
        executeStart(true, activeLobbyId, { seats: finalSeats });
      };
      autoStart();
    }
  }, [seats, timeLeft, isHost, lobbyStatus, isLobbyPublic, activeLobbyId]);

  const pushUpdate = async (field, value) => {
    if (activeLobbyId) {
      try { 
        const updates = { [field]: value };
        if (field === 'seats') {
          updates.openSeats = Object.values(value).filter(s => s.type === 'human' && !s.uid).length;
        }
        await rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), updates); 
        if (field === 'seats') {
          updateCrazyGamesRoom('update', value);
        }
      } catch (e) { 
        console.error("Sync error:", e); 
        alert(`Failed to sync ${field}. Check console for details.`);
      }
    }
  };

  const handleSeatTypeChange = (playerId, newType) => {
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], type: newType } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  const handleSeatColorChange = (playerId, colorName) => {
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], color: colorName } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  const handleSeatNameChange = (playerId, newName) => {
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], name: newName } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  const handleClaimSeat = (playerId) => {
    // Forcing type to 'human' allows joiners to overtake bot/closed slots
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], type: 'human', uid: user.uid, name: localPlayerName } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  useEffect(() => {
    // Auto-assign random matchmaking players to an open seat without needing to click
    if (isLobbyPublic && activeLobbyId && user && lobbyStatus === 'waiting' && !hasClaimedSeat) {
      let validSeatIds = ['Player1', 'Player2', 'Player3', 'Player4'];
      if (matchType === '1v1') validSeatIds = ['Player1', 'Player3'];
      
      let targetSeat = validSeatIds.find(id => seats[id].type === 'human' && !seats[id].uid);
      if (!targetSeat) targetSeat = validSeatIds.find(id => seats[id].type === 'bot' && !seats[id].uid);
      
      if (targetSeat) {
        handleClaimSeat(targetSeat);
      } else {
        alert(t('lobbyFullOrCorrupt', 'This lobby is full. Redirecting to menu...'));
        window.location.href = window.location.pathname;
      }
    }
  }, [isLobbyPublic, activeLobbyId, user, seats, lobbyStatus, hasClaimedSeat, matchType, t]);

  // Host: Send Heartbeat to keep lobby alive and setup beforeunload
  useEffect(() => {
    if (!isHost || !activeLobbyId || lobbyStatus !== 'waiting') return;

    const pushPing = () => {
      rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), { lastPing: Date.now() }).catch(() => {});
    };

    pushPing();
    const pingInterval = setInterval(pushPing, 10000);

    const handleUnload = () => {
      rtdbRemove(rtdbRef(rtdb, 'lobbies/' + activeLobbyId)).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isHost, activeLobbyId, lobbyStatus]);

  // Client: Monitor Host Heartbeat
  useEffect(() => {
    if (isHost || !activeLobbyId || lobbyStatus !== 'waiting' || !hostLastPing) return;

    const monitorInterval = setInterval(() => {
      if (Date.now() - hostLastPing > 25000) {
        alert(t('hostOffline', 'The host has disconnected. Lobby closed.'));
        window.location.href = window.location.pathname;
      }
    }, 5000);

    return () => clearInterval(monitorInterval);
  }, [isHost, activeLobbyId, lobbyStatus, hostLastPing, t]);

  useEffect(() => {
    if (playerCount !== 4) setIsTeamMode(false); // Team mode strictly 2v2
  }, [playerCount]);

  const startPortalBotMatch = () => {
    const newSeats = {
      Player1: { type: 'human', color: 'ruby', name: localPlayerName, uid: null },
      Player2: { type: 'bot', color: 'sapphire', name: '', uid: null },
      Player3: { type: 'bot', color: 'emerald', name: '', uid: null },
      Player4: { type: 'bot', color: 'amber', name: '', uid: null }
    };

    executeStart(false, null, {
      seats: newSeats,
      isQuickGame: false,
      isTeamMode: false,
      botDifficulty: 'easy',
      isVoidRuleEnabled: false,
      initialPiecePathIndex: 2,
    });
  };

  const closeOfflineResumeDialog = () => setOfflineResumeAction(null);

  const handleResumeExistingOffline = () => {
    closeOfflineResumeDialog();
    onResumeGame();
  };

  const handleStartNewOffline = () => {
    const continueAction = offlineResumeAction;
    closeOfflineResumeDialog();
    onClearOfflineResume?.();
    continueAction?.();
  };

  const promptForSavedResume = (mode, continueAction) => {
    if (mode === 'local' && hasCachedGame) {
      setOfflineResumeAction(() => continueAction);
      return;
    }

    if (resumeOnlineGameId) {
      const promptKey = mode === 'local' ? 'resumeOnlineBeforeLocalPrompt' : 'resumeOnlineBeforeOnlinePrompt';
      const fallbackMessage = mode === 'local'
        ? 'A saved online match is linked to your account. Press OK to resume it, or Cancel to stay on the menu.'
        : 'A saved online match is linked to your account. Press OK to resume it, or Cancel to stay on the menu.';
      const shouldResumeOnline = window.confirm(t(promptKey, fallbackMessage));

      if (shouldResumeOnline) {
        onReconnectOnline(resumeOnlineGameId);
        return;
      }

      return;
    }

    continueAction();
  };

  const openLocalSetup = () => promptForSavedResume('local', () => {
    setSetupMode('local');
    if (IS_PORTAL) {
      setSetupStep('config');
      return;
    }

    setSeats({
      Player4: { type: 'closed', color: 'amber', name: '', uid: null },
      Player3: { type: 'closed', color: 'emerald', name: '', uid: null },
      Player1: { type: 'human', color: 'ruby', name: localPlayerName, uid: null },
      Player2: { type: 'bot', color: 'sapphire', name: '', uid: null }
    });
    setIsTeamMode(false);
    setSetupStep('seats');
  });

  const openPublicSetup = () => {
    if (economyStatus === 'loading') {
      setEconomyNotice(t('economyLoading', 'Loading your Temple Coins…'));
      return;
    }
    if (!canAffordPublicMatch) {
      setEconomyNotice(t(
        'publicMatchInsufficientCoins',
        'Public Online Match requires {{entry}} coins. Check Rewards to claim your free daily coins.',
        { entry: PUBLIC_MATCH_ENTRY_COINS },
      ));
      return;
    }
    setEconomyNotice(null);
    promptForSavedResume('online', () => {
      setSetupMode('public');
      setSetupStep('config');
    });
  };

  const handleSeatSkinChange = (playerId, pieceSkinId) => {
    const normalizedSkinId = normalizePieceSkinId(pieceSkinId);
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], pieceSkinId: normalizedSkinId } };
    setSeats(newSeats);
    pushUpdate('seats', newSeats);
  };

  const openPrivateSetup = () => promptForSavedResume('online', () => {
    setSetupMode('private');
    setSetupStep('config');
  });

  const openPlayWithFriends = () => promptForSavedResume('online', () => {
    handleHostOnlineClick(false, INSTANT_MULTIPLAYER_CONFIG);
  });

  const executeStart = async (isOnline = false, targetGameId = null, overrideData = null) => {
    const currentSeats = overrideData?.seats || seats;
    const currentMatchType = overrideData?.matchType || matchType;
    const currentActiveSeats = Object.entries(currentSeats).filter(([_, s]) => s.type !== 'closed');
    const currentActiveColors = currentActiveSeats.map(([_, s]) => s.color);
    const bots = currentActiveSeats.filter(([_, s]) => s.type === 'bot').map(([id]) => id);
    const isPublicMatch = overrideData?.isPublic ?? isLobbyPublic;
    
    if (!overrideData) { // Only validate if we are initiating the start locally
      if (currentActiveSeats.length < 2) return alert(t('needTwoPlayers', "Need at least 2 players."));
      if (isOnline) {
        const humanCount = currentActiveSeats.filter(([_, s]) => s.type === 'human').length;
        if (humanCount < 2) return alert(t('onlineHumansRequired', "Online games require at least 2 human players."));
        if (currentActiveSeats.length === 4 && bots.length > 1) return alert(t('maxOneBotInFourPlayer', "Maximum 1 bot allowed in a 4-player game."));
        const unclaimedHumans = currentActiveSeats.filter(([_, s]) => s.type === 'human' && !s.uid).length;
        if (unclaimedHumans > 0) return alert(t('allHumansMustBeClaimed', "All human seats must be claimed before starting."));
      } else {
        if (currentActiveSeats.filter(([_, s]) => s.type === 'human').length === 0) return alert(t('needOneHuman', "Need at least 1 human player."));
      }
      if (new Set(currentActiveColors).size !== currentActiveColors.length) return alert(t('uniqueColorsRequired', "Each active player must have a unique color."));
    }

    if (requiresPublicMatchEntry({ isOnline, isPublic: isPublicMatch })) {
      if (!targetGameId || startingGameIdsRef.current.has(targetGameId)) return;
      startingGameIdsRef.current.add(targetGameId);

      try {
        await reservePublicEntry(targetGameId);
      } catch (entryError) {
        startingGameIdsRef.current.delete(targetGameId);
        const message = entryError?.code === 'insufficient-coins'
          ? t('publicMatchInsufficientCoins', 'Public Online Match requires {{entry}} coins. Check Rewards to claim your free daily coins.', { entry: PUBLIC_MATCH_ENTRY_COINS })
          : t('publicMatchEntryFailed', 'Could not reserve the public match entry. Please try again.');
        setEconomyNotice(message);
        alert(message);
        return;
      }
    }

    const activeSeatIds = currentActiveSeats.map(([id]) => id).sort();
    const playerColors = activeSeatIds.map(id => currentSeats[id].color);
    
    const playerAliases = {};
    const playerUids = {};
    const playerSkins = {};
    activeSeatIds.forEach(id => {
      playerAliases[id] = currentSeats[id].name.trim() || (currentSeats[id].type === 'bot' ? `${t('bot', 'Bot')} ${id.replace('Player', '')}` : `${t('player', 'Player')} ${id.replace('Player', '')}`);
      playerUids[id] = currentSeats[id].uid || null;
      playerSkins[id] = normalizePieceSkinId(currentSeats[id].pieceSkinId);
    });

    onStartGame({ 
      playerCount: activeSeatIds.length, activeSeats: activeSeatIds, playerColors, playerAliases, playerUids, playerSkins,
      isVoidRuleEnabled: IS_PORTAL ? false : (overrideData?.isVoidRuleEnabled ?? isVoidRuleEnabled), bots, botDifficulty: overrideData?.botDifficulty ?? botDifficulty,
      isQuickGame: overrideData?.isQuickGame ?? isQuickGame, isTeamMode: overrideData?.isTeamMode ?? isTeamMode, isOnline, gameId: targetGameId,
      initialPiecePathIndex: overrideData?.initialPiecePathIndex ?? (isOnline ? 2 : null),
      matchType: currentMatchType,
      hostUid: overrideData?.hostUid || user?.uid || null, localUid: user?.uid || null,
      isPublic: isPublicMatch,
      economy: isPublicMatch ? getPublicEconomyMetadata(currentMatchType) : null
    });
  };

  useEffect(() => {
    if (!IS_PORTAL || !autoStartPortalIntro || activeLobbyId || setupMode) return;

    onPortalAutoStartConsumed?.();
    startPortalBotMatch();
  }, [autoStartPortalIntro, activeLobbyId, setupMode, localPlayerName, onPortalAutoStartConsumed]);

  const handleHostOnlineClick = async (isPublicLobby = false, overrideConfig = null) => {
    const isPublic = typeof isPublicLobby === 'boolean' ? isPublicLobby : false;
    
    const currentMatchType = overrideConfig?.matchType || matchType;
    const currentIsQuickGame = overrideConfig?.isQuickGame ?? isQuickGame;
    const currentIsVoidRuleEnabled = IS_PORTAL ? false : (overrideConfig?.isVoidRuleEnabled ?? isVoidRuleEnabled);
    const currentBotDifficulty = overrideConfig?.botDifficulty || botDifficulty;

    let newSeats = {};
    if (currentMatchType === '1v1') {
      newSeats = {
        Player4: { type: 'closed', color: 'amber', name: '', uid: null },
        Player3: { type: 'human', color: 'emerald', name: '', uid: null },
        Player1: { type: 'human', color: 'ruby', name: localPlayerName, uid: null },
        Player2: { type: 'closed', color: 'sapphire', name: '', uid: null }
      };
    } else {
      newSeats = {
        Player4: { type: 'human', color: 'amber', name: '', uid: null },
        Player3: { type: 'human', color: 'emerald', name: '', uid: null },
        Player1: { type: 'human', color: 'ruby', name: localPlayerName, uid: null },
        Player2: { type: 'human', color: 'sapphire', name: '', uid: null }
      };
    }
    
    const currentActiveSeats = Object.values(newSeats).filter(s => s.type !== 'closed');

    setIsHosting(true);
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const preferredOrder = ['Player1', 'Player2', 'Player3', 'Player4'];
    const firstHuman = preferredOrder.find(id => newSeats[id].type === 'human');
    if (firstHuman) {
      newSeats[firstHuman].uid = user?.uid || null;
      newSeats[firstHuman].name = localPlayerName;
    }
    
    const expiresAt = isPublic ? Date.now() + 60000 : null; // 60 second matchmaking timer
    const isTeamModeLocal = (currentMatchType === '2v2');

    try {
      await rtdbSet(rtdbRef(rtdb, 'lobbies/' + newGameId), {
        seats: newSeats, botDifficulty: currentBotDifficulty, isVoidRuleEnabled: currentIsVoidRuleEnabled, isQuickGame: currentIsQuickGame, isTeamMode: isTeamModeLocal, hostUid: user?.uid || null, gameStarted: false,
        isPublic, status: 'waiting', expiresAt, matchType: currentMatchType,
        version: 2,
        lastPing: Date.now(),
        openSeats: Object.values(newSeats).filter(s => s.type === 'human' && !s.uid).length,
        economy: isPublic ? getPublicEconomyMetadata(currentMatchType) : null
      });
  
      setSeats(newSeats);
      setIsTeamMode(isTeamModeLocal);
      setPendingGameId(newGameId);
      await updateCrazyGamesRoom('update', newSeats, newGameId);
      
      if (overrideConfig) {
        setMatchType(currentMatchType);
        setIsQuickGame(currentIsQuickGame);
        setIsVoidRuleEnabled(currentIsVoidRuleEnabled);
      }
    } catch (error) {
      console.error("Firebase Error:", error);
      alert(t('failedToCreateLobby', "Failed to create online lobby. Please check your Firestore Security Rules in the Firebase Console!"));
    } finally {
      setIsHosting(false);
    }
  };

  useEffect(() => {
    if (
      !IS_PORTAL ||
      !autoStartInstantMultiplayer ||
      activeLobbyId ||
      setupMode ||
      !user ||
      isHosting ||
      isSearching
    ) {
      return;
    }

    onInstantMultiplayerConsumed?.();
    handleHostOnlineClick(false, INSTANT_MULTIPLAYER_CONFIG);
  }, [autoStartInstantMultiplayer, activeLobbyId, setupMode, user, isHosting, isSearching, localPlayerName, onInstantMultiplayerConsumed]);

  useEffect(() => {
    if (
      !autoStartPlayWithFriendsConfig ||
      activeLobbyId ||
      setupMode ||
      !user ||
      isHosting ||
      isSearching
    ) {
      return;
    }

    onPlayWithFriendsAutoStartConsumed?.();
    handleHostOnlineClick(false, autoStartPlayWithFriendsConfig);
  }, [autoStartPlayWithFriendsConfig, activeLobbyId, setupMode, user, isHosting, isSearching, localPlayerName, onPlayWithFriendsAutoStartConsumed]);

  const handleFindMatch = async (overrideConfig = null) => {
    if (economyStatus === 'loading' || !canAffordPublicMatch) {
      setEconomyNotice(t(
        'publicMatchInsufficientCoins',
        'Public Online Match requires {{entry}} coins. Check Rewards to claim your free daily coins.',
        { entry: PUBLIC_MATCH_ENTRY_COINS },
      ));
      return;
    }

    setIsSearching(true);
    const currentMatchType = overrideConfig?.matchType || matchType;
    const currentIsQuickGame = overrideConfig?.isQuickGame ?? isQuickGame;
    const currentIsVoidRuleEnabled = IS_PORTAL ? false : (overrideConfig?.isVoidRuleEnabled ?? isVoidRuleEnabled);

    const availableGameId = await findRandomPublicGame({
      matchType: currentMatchType,
      isQuickGame: currentIsQuickGame,
      isTeamMode: currentMatchType === '2v2',
      isVoidRuleEnabled: currentIsVoidRuleEnabled
    });

    if (availableGameId) {
      try {
        const lobbySnap = await rtdbGet(rtdbRef(rtdb, 'lobbies/' + availableGameId));
        if (lobbySnap.exists()) {
          const data = lobbySnap.val();
          if (data.matchType !== currentMatchType || (data.lastPing && Date.now() - data.lastPing > 25000)) {
            await handleHostOnlineClick(true, overrideConfig);
            setIsSearching(false);
            return;
          }
        }
      } catch (e) {
        console.error("Lobby validation failed", e);
      }

      if (overrideConfig) {
        setMatchType(currentMatchType);
        setIsQuickGame(currentIsQuickGame);
        setIsTeamMode(currentMatchType === '2v2');
        setIsVoidRuleEnabled(currentIsVoidRuleEnabled);
        setBotDifficulty(overrideConfig.botDifficulty || botDifficulty);
      }

      window.history.pushState({}, '', `?join=${availableGameId}`);
      onReconnectOnline(availableGameId);
    } else {
      // No games found. Host a new public game!
      await handleHostOnlineClick(true, overrideConfig);
    }
    setIsSearching(false);
  };

  const handleStartOnlineMatch = async () => {
    let finalSeats = null;
    if (isLobbyPublic) {
      const claimedCount = Object.values(seats).filter(s => s.type === 'human' && s.uid).length;
      if (claimedCount < 2) return alert(t('onlineHumansRequired', "Online games require at least 2 human players."));

      finalSeats = { ...seats };
      Object.keys(finalSeats).forEach(k => {
        if (finalSeats[k].type === 'human' && !finalSeats[k].uid) {
          finalSeats[k] = { ...finalSeats[k], type: 'closed' };
        }
      });
    }

    setLobbyStatus('playing');
    const updates = { status: 'playing', gameStarted: true, openSeats: 0 };
    if (finalSeats) updates.seats = finalSeats;
    try {
      await rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), updates);
      updateCrazyGamesRoom('start', finalSeats || seats);
    } catch (e) { console.error(e); }
    executeStart(true, activeLobbyId, finalSeats ? { seats: finalSeats } : null);
  };

  useEffect(() => {
    if (!activeLobbyId) {
      setInviteUrl('');
      return;
    }
    const defaultUrl = `${window.location.origin}${window.location.pathname}?join=${activeLobbyId}`;
    let isMounted = true;

    if (IS_PORTAL && window.CrazyGames?.SDK) {
      const fetchLink = async () => {
        try {
          if (window.cgInitPromise) await window.cgInitPromise;
          if (!isMounted) return;
          
          const link = await window.CrazyGames.SDK.game.inviteLink({ roomId: activeLobbyId });
          setInviteUrl(link || defaultUrl);
          
          // Render the native CrazyGames social invite overlay button
          window.CrazyGames.SDK.game.showInviteButton({ roomId: activeLobbyId });
        } catch(e) { setInviteUrl(defaultUrl); }
      };
      fetchLink();

      return () => {
        isMounted = false;
        try { window.CrazyGames.SDK.game.hideInviteButton(); } catch(e) {}
      };
    } else {
      setInviteUrl(defaultUrl);
    }
  }, [activeLobbyId]);

  const isInitialMenu = !activeLobbyId && !setupMode;
  const isSetupConfig = !activeLobbyId && setupMode && setupStep === 'config';
  const isSeatSetup = !activeLobbyId && setupMode === 'local' && setupStep === 'seats';
  const isLobbyStage = isInitialMenu || isSetupConfig || isSeatSetup || !!activeLobbyId;
  const showLobbyBranding = isInitialMenu || isSetupConfig;
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;
  const MenuIcon = DYUT_ICONS.menu;
  const HowToPlayIcon = DYUT_ICONS.howToPlay;
  const RulesIcon = DYUT_ICONS.rules;
  const HistoryIcon = DYUT_ICONS.history;
  const InfoIcon = DYUT_ICONS.info;
  const ResumeIcon = DYUT_ICONS.resumeOffline;
  const BackIcon = DYUT_ICONS.back;
  const LocalModeIcon = DYUT_ICONS.battle;
  const OnlineModeIcon = DYUT_ICONS.language;
  const PrivateModeIcon = DYUT_ICONS.privateMatch;
  const PublicLobbyIcon = DYUT_ICONS.inviteFriend;
  const ReconnectIcon = DYUT_ICONS.shareMatch;
  const QuickIcon = DYUT_ICONS.quickMode;
  const EasyIcon = DYUT_ICONS.easyDifficulty;
  const HardIcon = DYUT_ICONS.hardDifficulty;
  const StartIcon = DYUT_ICONS.next;
  const configPrimaryButtonClass = "lobby-config-primary-action w-full rounded-xl border border-yellow-200/50 bg-gradient-to-b from-yellow-300 via-gold to-amber-700 py-3.5 font-display text-3xl font-bold uppercase tracking-widest text-charcoal shadow-[0_0_28px_rgba(234,179,8,0.36),inset_0_2px_10px_rgba(255,255,255,0.35)] transition-all hover:scale-[1.01] hover:brightness-110 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-70 sm:text-4xl lg:py-2.5 lg:text-[1.95rem]";

  return (
    <>
      {offlineResumeAction && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/86 px-4 backdrop-blur-md">
          <div role="dialog" aria-modal="true" aria-labelledby="offline-resume-title" className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-gold/55 bg-[#050403] p-5 text-center shadow-[0_0_70px_rgba(0,0,0,0.95),inset_0_0_34px_rgba(234,179,8,0.08)] sm:p-6">
            <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-[24px] border-l border-t border-gold/75"></span>
            <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-[24px] border-r border-t border-gold/75"></span>
            <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[24px] border-b border-l border-gold/75"></span>
            <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[24px] border-b border-r border-gold/75"></span>

            <div className="font-display text-xs font-bold uppercase tracking-[0.28em] text-gold/70">
              {t('savedOfflineGame', 'Saved Offline Game')}
            </div>
            <h2 id="offline-resume-title" className="mt-3 font-display text-3xl font-bold uppercase tracking-[0.12em] text-gold text-glow-gold sm:text-4xl">
              {t('resumeExistingGameTitle', 'Resume Game?')}
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-[0.95rem] font-semibold leading-relaxed text-[#fff4c7] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              {t('resumeOfflineBeforeLocalPrompt', 'A saved offline game exists on this device. Choose how you want to continue.')}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={handleResumeExistingOffline} className="w-full rounded-xl border border-gold/55 bg-gold/12 py-3 font-display text-lg font-bold uppercase tracking-[0.16em] text-gold shadow-[0_0_24px_rgba(234,179,8,0.22),inset_0_0_18px_rgba(234,179,8,0.08)] transition-all hover:scale-[1.01] hover:bg-gold/20">
                {t('resumeExisting', 'Resume Existing')}
              </button>
              <button type="button" onClick={handleStartNewOffline} className="w-full rounded-xl border border-gold/35 bg-white/10 py-3 font-display text-base font-bold uppercase tracking-[0.16em] text-gold transition-all hover:border-gold/65 hover:bg-gold/15">
                {t('newGame', 'New Game')}
              </button>
              <button type="button" onClick={closeOfflineResumeDialog} className="w-full rounded-xl border border-white/10 bg-transparent py-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-white/60 transition-colors hover:border-white/25 hover:text-white/90">
                {t('goToMenu', 'Go to Menu')}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLobbyStage && (
        <div className="fixed inset-0 z-0 overflow-hidden bg-[#0f0d0b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(183,87,24,0.28),transparent_38%),linear-gradient(90deg,rgba(4,3,2,0.9),rgba(18,14,11,0.5)_28%,rgba(18,14,11,0.5)_72%,rgba(4,3,2,0.9))]"></div>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_center,rgba(126,32,18,0.42),transparent_58%)]"></div>
          <div className="absolute inset-x-0 bottom-0 hidden h-40 bg-[linear-gradient(0deg,rgba(108,28,14,0.34),transparent)] lg:block"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0,rgba(0,0,0,0.05)_38%,rgba(0,0,0,0.58)_100%)]"></div>
        </div>
      )}
      {/* Top Navigation Bar */}
      <header className={`fixed top-0 left-0 z-50 flex w-full items-center justify-between gap-3 bg-transparent px-4 py-4 md:px-8 lg:grid lg:grid-cols-[auto_1fr_auto] ${isLobbyStage ? 'lg:py-4' : ''}`}>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={toggleMute} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors p-1" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
            <SoundIcon className={`h-5 w-5 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <nav className="hidden min-w-0 items-center justify-center gap-4 lg:flex xl:gap-7">
          <button onClick={onShowTutorial} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><HowToPlayIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('howToPlay', 'How to Play')}</span></button>
          <button onClick={onShowRules} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><RulesIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('rules', 'Rules')}</span></button>
          <button onClick={onShowHistory} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><HistoryIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('history', 'History')}</span></button>
          <button onClick={onShowAbout} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><InfoIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('aboutUs', 'About Us')}</span></button>
        </nav>
        
        <div className="flex items-center justify-end gap-3">
          <EconomySummary compact />
          <PlayerProfile user={user} />
          
          <div className="relative flex items-center lg:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] p-2 ml-2">
              <MenuIcon className="h-6 w-6" aria-hidden="true" />
            </button>
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-12 glass-panel p-4 rounded-xl flex flex-col gap-4 min-w-[150px] shadow-2xl z-50 bg-[var(--color-panel-bg)]">
                <button onClick={() => { setIsMobileMenuOpen(false); onShowTutorial(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><HowToPlayIcon className="h-4 w-4" aria-hidden="true" />{t('howToPlay', 'How to Play')}</button>
                <button onClick={() => { setIsMobileMenuOpen(false); onShowRules(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><RulesIcon className="h-4 w-4" aria-hidden="true" />{t('rules', 'Rules')}</button>
                <button onClick={() => { setIsMobileMenuOpen(false); onShowHistory(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><HistoryIcon className="h-4 w-4" aria-hidden="true" />{t('history', 'History')}</button>
                <button onClick={() => { setIsMobileMenuOpen(false); onShowAbout(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><InfoIcon className="h-4 w-4" aria-hidden="true" />{t('aboutUs', 'About Us')}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`${isLobbyStage ? `lobby-viewport relative z-10 mx-auto flex h-[100dvh] w-full max-w-6xl flex-col items-center px-4 sm:px-6 ${isSetupConfig ? 'lobby-config-viewport justify-start overflow-hidden pb-3 pt-[clamp(4rem,9dvh,5rem)] sm:pb-4' : isInitialMenu ? 'justify-start overflow-hidden pb-6 pt-[clamp(5rem,10dvh,6rem)] sm:pb-8 lg:pb-10 lg:pt-[clamp(5rem,9dvh,6rem)] xl:pb-12' : 'lobby-seat-viewport justify-center overflow-hidden pb-3 pt-[clamp(3.75rem,8dvh,4.75rem)] sm:pb-4'}` : 'glass-panel p-6 sm:p-8 rounded-3xl w-full max-w-md flex flex-col items-center relative z-10 mt-32 sm:mt-24 lg:mt-16 mx-auto'}`}>
        {activeLobbyId && (
        <div className="lobby-invite-summary mb-4 flex w-full max-w-[min(92vw,560px)] flex-col items-center rounded-xl border border-white/10 bg-black/40 p-3 animate-fade-in sm:mb-5 sm:p-4">
          <div className="flex items-center gap-3 mb-3">
            {isLobbyPublic ? (
              <div className="flex flex-col items-start gap-1" title="Public Lobby">
                <div className="flex items-center gap-2">
                  <PublicLobbyIcon className="h-4 w-4 text-emerald" aria-hidden="true" />
                  <span className="text-gold font-bold text-sm tracking-widest uppercase">{t('publicLobby', 'PUBLIC LOBBY')} - ID: {activeLobbyId}</span>
                </div>
                {lobbyStatus === 'waiting' && timeLeft !== null && (
                  <span className="text-[10px] text-emerald font-bold uppercase tracking-widest animate-pulse ml-6">
                    {timeLeft > 0 ? `${t('startingIn', 'STARTING IN')} ${timeLeft}s` : t('waitingForPlayers', 'WAITING FOR PLAYERS...')}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2" title="Private Lobby">
                <PrivateModeIcon className="h-4 w-4 text-ruby" aria-hidden="true" />
                <span className="text-gold font-bold text-sm tracking-widest uppercase">{t('privateLobby', 'PRIVATE LOBBY')} - ID: {activeLobbyId}</span>
              </div>
            )}
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-start ${connectionStatus === 'connected' ? 'bg-emerald/20 text-emerald' : 'bg-ruby/20 text-white'}`}>
              {connectionStatus.startsWith('error') 
                ? connectionStatus 
                : t(`status_${connectionStatus}`, connectionStatus === 'waiting' ? 'Waiting...' : connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus === 'connected' ? 'Connected' : 'Lobby not found')}
            </span>
          </div>
          <div className="lobby-invite-url flex w-full gap-2">
            <input type="text" readOnly value={inviteUrl} className="flex-1 bg-black/60 border border-white/5 text-white/80 font-sans text-xs px-3 py-2 rounded-lg focus:outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-colors">{isCopied ? t('copied', 'Copied!') : t('copy', 'Copy')}</button>
          </div>
        </div>
      )}
      
      {showLobbyBranding && <h1 className={`dyut-title shrink-0 font-bold tracking-widest text-glow-gold text-[var(--color-gold)] ${isSetupConfig ? 'mb-0.5 text-[clamp(1.85rem,3.45vw,3rem)] leading-none sm:mb-1.5' : 'mb-1 text-[clamp(2.1rem,4vw,3.45rem)] leading-none sm:mb-2'}`}>DYUT</h1>}
      {showLobbyBranding && <OrnateDivider />}
      
      <div className={`${isLobbyStage ? `${isSetupConfig ? 'mt-1.5 w-full max-w-[880px] sm:mt-2 lg:max-w-[min(60vw,780px)] xl:max-w-[820px]' : isInitialMenu ? 'mt-[clamp(0.75rem,2dvh,1rem)] w-full shrink-0 max-w-[min(92vw,760px)]' : 'mt-3 w-full max-w-[880px] sm:mt-4 lg:max-w-[min(62vw,780px)] xl:max-w-[820px]'}` : 'w-full'}`}>
        {/* --- STATE 1: MAIN MENU --- */}
        {!activeLobbyId && !setupMode && (
          <div className={`${isInitialMenu ? 'relative w-full animate-fade-in rounded-[clamp(1.1rem,2vw,1.5rem)] border border-gold/45 bg-[#100e0c]/90 p-[clamp(0.5rem,1.2vw,0.85rem)] shadow-[0_0_55px_rgba(0,0,0,0.68),inset_0_0_45px_rgba(234,179,8,0.07)]' : 'w-full flex flex-col gap-3 animate-fade-in'}`}>
            {isInitialMenu && (
              <>
                <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-[24px] border-l border-t border-gold/70"></span>
                <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-[24px] border-r border-t border-gold/70"></span>
                <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[24px] border-b border-l border-gold/70"></span>
                <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[24px] border-b border-r border-gold/70"></span>
              </>
            )}
            {IS_PORTAL ? (
              <>
                <div className="flex w-full flex-col gap-[clamp(0.35rem,1dvh,0.6rem)]">
                  <LobbyModeCard
                    tone="gold"
                    icon={<LocalModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                    title={t('playNow', 'PLAY NOW')}
                    description={t('playNowSubtitle', 'Start an instant offline battle against temple-trained rivals.')}
                    onClick={() => promptForSavedResume('local', startPortalBotMatch)}
                  />
                    <LobbyModeCard
                      tone="ruby"
                      icon={<OnlineModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={isSearching ? t('searching', 'SEARCHING...') : t('playOnline', 'PLAY ONLINE')}
                      description={t('publicMatchCoinSubtitle', '{{entry}} coins · Winner receives 90% of the pool.', { entry: PUBLIC_MATCH_ENTRY_COINS })}
                      onClick={() => promptForSavedResume('online', () => handleFindMatch({ matchType: 'ffa', isQuickGame: false, isVoidRuleEnabled: true, botDifficulty: 'easy' }))}
                      disabled={isSearching || isHosting}
                  />
                  <LobbyModeCard
                    tone="sapphire"
                    icon={<PrivateModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                    title={t('playWithFriends', 'PLAY WITH FRIENDS')}
                    description={t('playWithFriendsSubtitle', 'Start an invite-only online game for your friends.')}
                    onClick={openPlayWithFriends}
                  />
                </div>
              </>
            ) : (
              <>
                {isInitialMenu ? (
                  <div className="flex w-full flex-col gap-[clamp(0.35rem,1dvh,0.6rem)]">
                    <LobbyModeCard
                      tone="gold"
                      icon={<LocalModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={t('localPlay', 'LOCAL PLAY')}
                      description={t('localPlaySubtitle', 'Play with friends on the same device.')}
                      onClick={openLocalSetup}
                    />
                    <LobbyModeCard
                      tone="ruby"
                      icon={<OnlineModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={t('onlineMatch', 'ONLINE MATCH')}
                      description={t('publicMatchCoinSubtitle', '{{entry}} coins · Winner receives 90% of the pool.', { entry: PUBLIC_MATCH_ENTRY_COINS })}
                      onClick={openPublicSetup}
                    />
                    <LobbyModeCard
                      tone="sapphire"
                      icon={<PrivateModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={t('playWithFriends', 'PLAY WITH FRIENDS')}
                      description={t('playWithFriendsSubtitle', 'Start an invite-only online game for your friends.')}
                      onClick={openPrivateSetup}
                    />
                  </div>
                ) : (
                  <>
                    <button onClick={openLocalSetup} className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-[var(--color-panel-bg)] text-white font-sans font-semibold tracking-wide rounded-xl border-l-4 border-[var(--color-gold)] hover:bg-white/5 transition-all" title={t('localPlayTitle', 'Local Play')}>
                      <LocalModeIcon className="h-6 w-6 text-[var(--color-gold)]" aria-hidden="true" />
                      <span className="text-sm leading-none uppercase tracking-widest">{t('localPlay', 'LOCAL PLAY')}</span>
                    </button>

                    <button onClick={openPublicSetup} className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-[var(--color-panel-bg)] text-white font-sans font-semibold tracking-wide rounded-xl border-l-4 border-emerald-500 hover:bg-white/5 transition-all" title={t('findPublicMatchTitle', 'Find Public Match')}>
                      <OnlineModeIcon className="h-6 w-6 text-emerald-500" aria-hidden="true" />
                      <span className="text-sm leading-none uppercase tracking-widest">{t('publicMatch', 'PUBLIC MATCH')}</span>
                    </button>

                    <button onClick={openPrivateSetup} className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-[var(--color-panel-bg)] text-white font-sans font-semibold tracking-wide rounded-xl border-l-4 border-sky-400 hover:bg-white/5 transition-all" title={t('playWithFriends', 'Play with Friends')}>
                      <PrivateModeIcon className="h-6 w-6 text-sky-400" aria-hidden="true" />
                      <span className="text-sm leading-none uppercase tracking-widest">{t('playWithFriends', 'PLAY WITH FRIENDS')}</span>
                    </button>
                  </>
                )}
              </>
            )}

            {(hasCachedGame || resumeOnlineGameId) && (
              <div className={`${isInitialMenu ? 'mx-auto mt-2 flex w-full max-w-md gap-2' : 'flex gap-2 w-full mt-2'}`}>
                {hasCachedGame && (
                  <button onClick={onResumeGame} className={`${isInitialMenu ? 'border-gold/35 bg-white/10 text-gold' : 'border-white/10 bg-white/5 text-white'} flex flex-1 items-center justify-center gap-2 rounded-xl border py-2 font-sans text-xs font-semibold transition-colors hover:bg-white/15`}>
                    <ResumeIcon className="h-4 w-4 text-gold" aria-hidden="true" />
                    {t('resumeOffline', 'Resume Offline')}
                  </button>
                )}
                {resumeOnlineGameId && (
                  <button onClick={() => onReconnectOnline(resumeOnlineGameId)} className="flex-1 py-3 bg-white/5 text-sapphire font-sans text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    <ReconnectIcon className="h-4 w-4" aria-hidden="true" />
                    {t('reconnectOnline', 'Reconnect')}
                  </button>
                )}
              </div>
            )}
            {economyNotice && (
              <div role="alert" className="mx-auto mt-2 w-full max-w-md rounded-xl border border-ruby/40 bg-ruby/10 px-3 py-2 text-center text-xs font-semibold text-white/90">
                {economyNotice}
              </div>
            )}
            {IS_PORTAL && (
              <p className="mt-2 text-center text-[9px] leading-relaxed text-white/45">
                {t('portalLegalNotice', 'By playing Dyut on CrazyGames, you agree to the CrazyGames Terms & Conditions and Privacy Policy.')}
              </p>
            )}
          </div>
        )}

        {showLobbyBranding && (
          <div className={`${isSetupConfig ? 'hidden lg:contents' : 'mt-3 flex'} w-full max-w-[880px] flex-col items-start gap-3 sm:mt-4 lg:contents`}>
            <div className="lobby-fair-play flex w-full items-center gap-3 rounded-[8px] border border-gold/30 bg-black/55 px-3 py-2 text-left shadow-[0_0_22px_rgba(0,0,0,0.55)] lg:fixed lg:bottom-5 lg:left-8 lg:z-20 lg:max-w-[280px] lg:px-3.5 lg:py-2.5 xl:bottom-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-gold/40 bg-gold/10 text-gold">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 4.4-2.8 8.1-7 10-4.2-1.9-7-5.6-7-10V6l7-3z"></path>
                  <path d="M9 12l2 2 4-5"></path>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gold sm:text-base lg:text-[0.95rem]">{t('fairPlayTitle', 'Fair Play. Pure Dyut.')}</div>
                <div className="text-xs leading-snug text-white/70 sm:text-sm lg:text-[0.88rem]">{t('fairPlaySubtitle', 'Respect the game. Honor the tradition.')}</div>
              </div>
            </div>

          </div>
        )}

        {/* --- STATE 2: INTERMEDIATE CONFIG SCREEN --- */}
        {!activeLobbyId && setupMode && setupStep === 'config' && (
          <div className="lobby-config-panel relative w-full animate-fade-in rounded-[24px] border border-gold/50 bg-[#120f0c]/95 p-4 shadow-[0_0_60px_rgba(0,0,0,0.72),inset_0_0_48px_rgba(234,179,8,0.07)] sm:p-6 lg:mx-auto lg:max-w-[min(60vw,780px)] lg:overflow-hidden lg:p-3.5 xl:max-w-[800px]">
            <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-[24px] border-l border-t border-gold/70"></span>
            <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-[24px] border-r border-t border-gold/70"></span>
            <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[24px] border-b border-l border-gold/70"></span>
            <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[24px] border-b border-r border-gold/70"></span>

            <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:mb-4 lg:mb-2">
              <button onClick={() => setSetupMode(null)} className="flex items-center gap-2 rounded-lg border border-gold/40 bg-white/[0.07] px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-white/85 transition-colors hover:border-gold/70 hover:bg-gold/10 hover:text-[#fff4c7] lg:px-3 lg:py-1.5 lg:text-[0.68rem]">
                <BackIcon className="h-4 w-4" aria-hidden="true" />
                {t('back', 'BACK')}
              </button>
              <h2 className="text-center font-display text-2xl font-bold uppercase tracking-widest text-gold text-glow-gold sm:text-3xl lg:text-[1.35rem]">
                {setupMode === 'public' ? t('publicMatch', 'PUBLIC MATCH') : setupMode === 'private' ? t('playWithFriends', 'PLAY WITH FRIENDS') : t('localPlay', 'LOCAL PLAY')}
              </h2>
              <div className="hidden w-[92px] sm:block"></div>
            </div>

            <div className="lobby-config-stack flex flex-col gap-3 sm:gap-4 lg:gap-2">
              <ConfigSectionTitle>{t('matchType', 'Match Type')}</ConfigSectionTitle>
              {setupMode === 'public' && (
                <div data-testid="public-match-fee" className="rounded-xl border border-gold/35 bg-gold/10 px-3 py-2 text-center text-xs font-semibold text-[#fff4c7]">
                  {matchType === '2v2'
                    ? t(
                      'publicTeamFeeDisclosure',
                      '{{entry}} coins per human · 10% match fee · Winning team gets 90% of the pool',
                      { entry: PUBLIC_MATCH_ENTRY_COINS },
                    )
                    : t(
                      'publicMatchFeeDisclosure',
                      '{{entry}} coins per player · 10% match fee · Winner receives 90% of the pool',
                      { entry: PUBLIC_MATCH_ENTRY_COINS },
                    )}
                </div>
              )}
              <div className="lobby-config-grid grid grid-cols-3 gap-2 sm:gap-4 lg:gap-2">
                <ConfigChoiceCard active={matchType === '1v1'} tone="sapphire" title={t('1v1', '1 vs 1')} subtitle={t('oneOnOne', 'Face off one on one')} onClick={() => setMatchType('1v1')}>
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-sapphire shadow-[0_0_10px_rgba(56,189,248,0.8)]"></span><span className="h-3 w-3 rounded-full bg-ruby shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span></div>
                  <LocalModeIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
                </ConfigChoiceCard>
                <ConfigChoiceCard active={matchType === '2v2'} tone="gold" title={t('2v2', '2 vs 2')} subtitle={setupMode === 'public' ? t('publicTeamPrizeSplit', 'Winning team gets 90% of the pool') : t('teamUpDominate', 'Team up and dominate')} onClick={() => setMatchType('2v2')}>
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span><span className="h-3 w-3 rounded-full bg-amber shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span></div>
                  <LocalModeIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
                </ConfigChoiceCard>
                <ConfigChoiceCard active={matchType === 'ffa'} tone="violet" title={t('ffa4p', 'FFA 4P')} subtitle={t('everyPlayerForThemselves', 'Every player for themselves')} onClick={() => setMatchType('ffa')}>
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-ruby shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span><span className="h-3 w-3 rounded-full bg-sapphire shadow-[0_0_10px_rgba(56,189,248,0.8)]"></span><span className="h-3 w-3 rounded-full bg-emerald shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span><span className="h-3 w-3 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></span></div>
                  <LocalModeIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
                </ConfigChoiceCard>
              </div>

              <ConfigSectionTitle>{t('gameRules', 'Game Rules')}</ConfigSectionTitle>
              <div className={`lobby-config-grid grid ${IS_PORTAL ? 'grid-cols-1' : 'grid-cols-2'} gap-3 sm:gap-4 lg:gap-2`}>
                {!IS_PORTAL && (
                  <ConfigChoiceCard active={isVoidRuleEnabled} tone="gold" title={t('voidRule', '1+3 Void')} subtitle={t('classicStrategicFormat', 'Classic strategic format')} onClick={() => setIsVoidRuleEnabled(!isVoidRuleEnabled)} className="min-h-[92px] lg:min-h-[64px]">
                    <RulesIcon className="h-8 w-8" aria-hidden="true" />
                  </ConfigChoiceCard>
                )}
                <ConfigChoiceCard active={isQuickGame} tone="gold" title={t('quick', 'Quick')} subtitle={t('fastPacedShortGames', 'Fast-paced & short games')} onClick={() => setIsQuickGame(!isQuickGame)} className="min-h-[92px] lg:min-h-[64px]">
                  <QuickIcon className="h-8 w-8" aria-hidden="true" />
                </ConfigChoiceCard>
              </div>

              {setupMode !== 'public' && (
                <>
                  <ConfigSectionTitle>{t('botDifficulty', 'Bot Difficulty')}</ConfigSectionTitle>
                  <div className="lobby-config-grid grid grid-cols-2 gap-3 sm:gap-4 lg:gap-2">
                    <ConfigChoiceCard active={botDifficulty === 'easy'} tone="emerald" title={t('easy', 'EASY')} subtitle={t('relaxedChallenge', 'Relaxed challenge')} onClick={() => setBotDifficulty('easy')} className="min-h-[86px] lg:min-h-[62px]">
                      <EasyIcon className="h-8 w-8" aria-hidden="true" />
                    </ConfigChoiceCard>
                    <ConfigChoiceCard active={botDifficulty === 'hard'} tone="ruby" title={t('hard', 'HARD')} subtitle={t('forSeasonedStrategists', 'For seasoned & strategists')} onClick={() => setBotDifficulty('hard')} className="min-h-[86px] lg:min-h-[62px]">
                      <HardIcon className="h-8 w-8" aria-hidden="true" />
                    </ConfigChoiceCard>
                  </div>
                </>
              )}
            </div>

            <div className="mx-auto mt-4 w-full max-w-[760px] lg:mt-2">
              {setupMode === 'local' && (
                <button onClick={() => {
                  let newSeats = {};
                  if (matchType === '1v1') {
                    newSeats = { Player4: { type: 'closed', color: 'amber', name: '', uid: null }, Player3: { type: 'human', color: 'emerald', name: '', uid: null }, Player1: { type: 'human', color: 'ruby', name: localPlayerName, uid: null }, Player2: { type: 'closed', color: 'sapphire', name: '', uid: null } };
                  } else {
                    newSeats = { Player4: { type: 'human', color: 'amber', name: '', uid: null }, Player3: { type: 'human', color: 'emerald', name: '', uid: null }, Player1: { type: 'human', color: 'ruby', name: localPlayerName, uid: null }, Player2: { type: 'human', color: 'sapphire', name: '', uid: null } };
                  }
                  setSeats(newSeats);
                  setIsTeamMode(matchType === '2v2');
                  setSetupStep('seats');
                }} className={configPrimaryButtonClass}>
                  {t('next', 'Next')}
                </button>
              )}
              {setupMode === 'public' && (
                <button onClick={() => handleFindMatch()} disabled={isSearching || isHosting} className={configPrimaryButtonClass}>
                  {isSearching ? t('searching', 'SEARCHING...') : t('findMatch', 'FIND MATCH')}
                </button>
              )}
              {setupMode === 'private' && (
                <button onClick={() => handleHostOnlineClick(false)} disabled={isHosting || isSearching} className={configPrimaryButtonClass}>
                  {isHosting ? t('hostingMatch', 'CREATING LOBBY...') : t('createLobby', 'CREATE LOBBY')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- STATE 3: LOCAL PLAY SETUP --- */}
        {!activeLobbyId && setupMode === 'local' && setupStep === 'seats' && (
          <div className="lobby-seat-layout w-full space-y-6 animate-fade-in lg:mx-auto lg:max-w-[min(34vw,430px)] lg:space-y-3.5">
            <div className="lobby-seat-header mb-4 flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] lg:mb-3">
              <button onClick={() => IS_PORTAL ? setSetupStep('config') : setSetupMode(null)} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/75 transition-colors hover:border-gold/45 hover:bg-white/15 hover:text-white"><BackIcon className="h-3 w-3" aria-hidden="true" /> {t('back', 'BACK')}</button>
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 lg:text-xs">{t('localPlay', 'LOCAL PLAY')}</h2>
              <div className="w-[72px]"></div>
            </div>

            <div className="w-full flex flex-col items-center">
              <h2 className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/70 lg:mb-3">{t('seatArrangement', 'Seat Arrangement')}</h2>
              <div className="lobby-seat-grid grid w-full max-w-[280px] grid-cols-2 gap-4 lg:max-w-[220px] lg:gap-2.5">
                 <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player4', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player3', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player1', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player2', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
              </div>
            </div>

            <button onClick={() => executeStart(false)} className="lobby-seat-primary-action w-full rounded-xl bg-gold py-4 font-display text-lg font-bold text-charcoal shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all hover:scale-[1.02] hover:bg-yellow-400 lg:py-2.5 lg:text-[0.95rem]">
              {t('startMatch', 'START MATCH')}
            </button>
          </div>
        )}

        {/* --- STATE 4: ACTIVE LOBBY (PUBLIC OR PRIVATE) --- */}
        {activeLobbyId && (
          <div className="lobby-seat-layout w-full space-y-6 animate-fade-in lg:mx-auto lg:max-w-[min(34vw,440px)] lg:space-y-3.5">
            <div className="w-full flex flex-col items-center">
              <h2 className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/70 lg:mb-3">{t('seatArrangement', 'Seat Arrangement')}</h2>
              <div className="lobby-seat-grid grid w-full max-w-[280px] grid-cols-2 gap-4 lg:max-w-[220px] lg:gap-2.5">
                 <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player4', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player3', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player1', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onSkinChange={(skinId) => handleSeatSkinChange('Player2', skinId)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
              </div>
            </div>

            <div className="lobby-active-actions mt-4 flex w-full flex-col gap-2 lg:mt-2.5">
            {isHost ? (
                <button onClick={handleStartOnlineMatch} className="lobby-seat-primary-action flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-4 font-display text-lg font-bold text-charcoal shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all hover:scale-[1.02] hover:bg-yellow-400 lg:py-2.5 lg:text-[0.95rem]">
                  <StartIcon className="h-6 w-6" aria-hidden="true" />
                  {t('startMatch', 'START MATCH')}
                </button>
            ) : (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 py-4 font-sans text-sm font-bold uppercase tracking-widest text-white/60 lg:py-3 lg:text-[0.72rem]">
                  <svg className="animate-spin h-5 w-5 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {t('waitingForHost', 'Waiting for Host...')}
                </div>
            )}
              <button onClick={async () => {
                if (IS_PORTAL && window.CrazyGames?.SDK) {
                  try { await window.CrazyGames.SDK.game.leftRoom(); } catch(e){}
                }
                window.location.href = window.location.pathname;
              }} className="w-full py-3 bg-transparent text-white/40 hover:text-white flex items-center justify-center gap-2 font-sans text-xs font-semibold rounded-xl transition-colors uppercase tracking-widest">
                {t('leaveLobby', 'Leave Lobby')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    </>
  );
};
export default UnifiedLobby;

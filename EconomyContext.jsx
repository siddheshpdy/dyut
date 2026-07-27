import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  claimDailyReward as claimDailyRewardService,
  getEconomyIdentity,
  loadEconomy,
  refundPublicMatchEntry as refundEntry,
  reservePublicMatchEntry as reserveEntry,
  settlePublicMatch as settleMatch,
} from './economyService.js';
import { getUtcDayKey, normalizeEconomyState } from './economy.js';

const EconomyContext = createContext(null);

export const EconomyProvider = ({ user, children }) => {
  const [economy, setEconomy] = useState(() => normalizeEconomyState());
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [dailyReward, setDailyReward] = useState(null);
  const [isClaimingDailyReward, setIsClaimingDailyReward] = useState(false);
  const [lastSettlement, setLastSettlement] = useState(null);
  const economyIdentity = getEconomyIdentity(user);
  const economyIsAnonymous = user?.isAnonymous ?? true;
  const economyUser = useMemo(() => ({
    uid: economyIdentity,
    isAnonymous: economyIsAnonymous,
  }), [economyIdentity, economyIsAnonymous]);

  const refresh = useCallback(async () => {
    const loaded = await loadEconomy(economyUser);
    setEconomy(loaded);
    return loaded;
  }, [economyUser]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    setDailyReward(null);

    loadEconomy(economyUser)
      .then((loaded) => {
        if (cancelled) return;
        setEconomy(loaded);
        setStatus('ready');
      })
      .catch((initializationError) => {
        if (cancelled) return;
        console.error('Failed to load economy:', initializationError);
        setError(initializationError);
        setEconomy(normalizeEconomyState());
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [economyIdentity, economyUser]);

  const runMutation = useCallback(async (operation) => {
    setError(null);
    try {
      const result = await operation();
      setEconomy(result.state);
      return result;
    } catch (operationError) {
      setError(operationError);
      throw operationError;
    }
  }, []);

  const reservePublicEntry = useCallback(
    (matchId) => runMutation(() => reserveEntry(economyUser, matchId)),
    [economyUser, runMutation],
  );

  const claimDailyReward = useCallback(async () => {
    setIsClaimingDailyReward(true);
    try {
      const result = await runMutation(() => claimDailyRewardService(economyUser));
      setDailyReward(result.applied ? {
        amount: result.event.delta,
        dayKey: result.event.dayKey,
      } : null);
      return result;
    } finally {
      setIsClaimingDailyReward(false);
    }
  }, [economyUser, runMutation]);

  const settlePublicMatch = useCallback(
    (settlement) => runMutation(() => settleMatch(economyUser, settlement)).then((result) => {
      setLastSettlement({
        matchId: settlement.matchId,
        ...result.settlement,
        applied: result.applied,
      });
      return result;
    }),
    [economyUser, runMutation],
  );

  const refundPublicEntry = useCallback(
    (matchId, reason) => runMutation(() => refundEntry(economyUser, matchId, reason)),
    [economyUser, runMutation],
  );

  const value = useMemo(() => ({
    balance: economy.coins,
    economy,
    status,
    error,
    dailyReward,
    dailyRewardAvailable: status === 'ready' && economy.lastDailyRewardDay !== getUtcDayKey(),
    isClaimingDailyReward,
    lastSettlement,
    refresh,
    claimDailyReward,
    reservePublicEntry,
    settlePublicMatch,
    refundPublicEntry,
  }), [
    claimDailyReward,
    dailyReward,
    economy,
    error,
    isClaimingDailyReward,
    lastSettlement,
    refresh,
    refundPublicEntry,
    reservePublicEntry,
    settlePublicMatch,
    status,
  ]);

  return <EconomyContext.Provider value={value}>{children}</EconomyContext.Provider>;
};

export const useEconomy = () => {
  const context = useContext(EconomyContext);
  if (!context) throw new Error('useEconomy must be used within EconomyProvider');
  return context;
};

export const useOptionalEconomy = () => useContext(EconomyContext);

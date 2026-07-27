import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  initializeDailyEconomy,
  getEconomyIdentity,
  loadEconomy,
  refundPublicMatchEntry as refundEntry,
  reservePublicMatchEntry as reserveEntry,
  settlePublicMatch as settleMatch,
} from './economyService.js';
import { getUtcDayKey, normalizeEconomyState } from './economy.js';

const EconomyContext = createContext(null);
const dailyInitializationPromises = new Map();

const initializeDailyOnce = (identity, user) => {
  const initializationKey = `${identity}:${getUtcDayKey()}`;
  if (!dailyInitializationPromises.has(initializationKey)) {
    dailyInitializationPromises.set(
      initializationKey,
      initializeDailyEconomy(user).catch((error) => {
        dailyInitializationPromises.delete(initializationKey);
        throw error;
      }),
    );
  }
  return dailyInitializationPromises.get(initializationKey);
};

export const EconomyProvider = ({ user, children }) => {
  const [economy, setEconomy] = useState(() => normalizeEconomyState());
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [dailyReward, setDailyReward] = useState(null);
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

    initializeDailyOnce(economyIdentity, economyUser)
      .then((result) => {
        if (cancelled) return;
        setEconomy(result.state);
        setDailyReward(result.applied ? {
          amount: result.event.delta,
          dayKey: result.event.dayKey,
        } : null);
        setStatus('ready');
      })
      .catch(async (initializationError) => {
        if (cancelled) return;
        console.error('Failed to initialize daily economy:', initializationError);
        setError(initializationError);
        try {
          const loaded = await loadEconomy(economyUser);
          if (!cancelled) setEconomy(loaded);
        } catch {
          setEconomy(normalizeEconomyState());
        }
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [economyIdentity, economyUser, refresh]);

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
    lastSettlement,
    refresh,
    reservePublicEntry,
    settlePublicMatch,
    refundPublicEntry,
  }), [
    dailyReward,
    economy,
    error,
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

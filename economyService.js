import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebaseSetup.js';
import {
  applyDailyLoginReward,
  claimGoalReward as applyGoalClaim,
  claimRewardMultiplier as applyRewardMultiplier,
  normalizeEconomyState,
  purchasePieceSkin as applyPieceSkinPurchase,
  recordOnlineGoalProgress as applyGoalProgress,
  refundPublicMatchEntry as applyPublicMatchRefund,
  reservePublicMatchEntry as applyPublicEntry,
  settlePublicMatch as applyPublicSettlement,
} from './economy.js';
import { parseCrazyGamesStoredValue, serializeCrazyGamesStoredValue } from './crazyGamesData.js';
import {
  claimDailyReward as claimDailyRewardServer,
  claimGoalReward as claimGoalRewardServer,
  claimRewardMultiplier as claimRewardMultiplierServer,
  getEconomyState as getEconomyStateServer,
  isServerAuthorityEnabled,
  purchasePieceSkin as purchasePieceSkinServer,
  recordGoalProgress as recordGoalProgressServer,
  refundPublicMatchEntry as refundPublicMatchEntryServer,
  reservePublicMatchEntry as reservePublicMatchEntryServer,
  settlePublicMatch as settlePublicMatchServer,
} from './serverAuthorityClient.js';

const IS_PORTAL = import.meta.env.VITE_CRAZYGAMES_BUILD === 'true';
const PORTAL_ECONOMY_KEY = 'dyut_economy';
const LOCAL_ECONOMY_PREFIX = 'dyut_economy:';

const isQaEconomyMode = () => (
  import.meta.env.DEV
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('qa')?.startsWith('economy')
);

export const getEconomyIdentity = (user) => {
  if (isQaEconomyMode()) return 'qa-user';
  if (IS_PORTAL) return 'portal-user';
  return user?.uid || 'guest';
};

const getLocalKey = (user) => `${LOCAL_ECONOMY_PREFIX}${getEconomyIdentity(user)}`;

const loadLocalState = (user) => {
  try {
    return normalizeEconomyState(
      parseCrazyGamesStoredValue(localStorage.getItem(getLocalKey(user)), {}),
    );
  } catch {
    return normalizeEconomyState();
  }
};

const saveLocalState = (user, state) => {
  localStorage.setItem(getLocalKey(user), serializeCrazyGamesStoredValue(state));
};

const getPortalDataModule = async () => {
  if (!IS_PORTAL || !window.CrazyGames?.SDK?.data) return null;
  if (window.cgInitPromise) await window.cgInitPromise;
  return window.CrazyGames.SDK.data;
};

const shouldUseLocalStorage = (user) => isQaEconomyMode() || !user || Boolean(user.isAnonymous);
const shouldUseServerEconomy = (user) => (
  !IS_PORTAL
  && isServerAuthorityEnabled()
  && Boolean(user?.uid)
  && user.uid !== 'guest'
  && user.uid !== 'qa-user'
);

const loadPortalState = async () => {
  const dataModule = await getPortalDataModule();
  if (!dataModule) return null;
  return normalizeEconomyState(
    parseCrazyGamesStoredValue(await dataModule.getItem(PORTAL_ECONOMY_KEY), {}),
  );
};

const mutateEconomy = async (user, mutation) => {
  const portalState = await loadPortalState();
  if (portalState) {
    const result = mutation(portalState);
    if (result.applied) {
      const dataModule = await getPortalDataModule();
      await dataModule.setItem(PORTAL_ECONOMY_KEY, serializeCrazyGamesStoredValue(result.state));
    }
    return result;
  }

  if (shouldUseLocalStorage(user)) {
    const result = mutation(loadLocalState(user));
    if (result.applied) saveLocalState(user, result.state);
    return result;
  }

  const userRef = doc(db, 'users', user.uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const remoteEconomy = snapshot.exists() ? snapshot.data()?.economy : null;
    const hasRemoteEconomy = Boolean(remoteEconomy);
    const currentState = normalizeEconomyState(
      hasRemoteEconomy ? remoteEconomy : loadLocalState(user),
    );
    const result = mutation(currentState);
    if (result.applied || !hasRemoteEconomy) {
      transaction.set(userRef, { economy: result.state }, { merge: true });
    }
    return result;
  });
};

export const loadEconomy = async (user) => {
  const portalState = await loadPortalState();
  if (portalState) return portalState;
  if (shouldUseServerEconomy(user)) {
    const result = await getEconomyStateServer();
    return normalizeEconomyState(result.state);
  }
  if (shouldUseLocalStorage(user)) return loadLocalState(user);

  const snapshot = await getDoc(doc(db, 'users', user.uid));
  const remoteEconomy = snapshot.exists() ? snapshot.data()?.economy : null;
  return normalizeEconomyState(remoteEconomy || loadLocalState(user));
};

export const claimDailyReward = async (user, now = Date.now()) => (
  shouldUseServerEconomy(user)
    ? claimDailyRewardServer()
    : mutateEconomy(user, (state) => applyDailyLoginReward(state, now))
);

export const recordOnlineGoalProgress = async (user, progress) => (
  shouldUseServerEconomy(user)
    ? recordGoalProgressServer(progress)
    : mutateEconomy(user, (state) => applyGoalProgress(state, progress))
);

export const claimGoalReward = async (user, reward) => (
  shouldUseServerEconomy(user)
    ? claimGoalRewardServer(reward)
    : mutateEconomy(user, (state) => applyGoalClaim(state, reward))
);

export const claimRewardMultiplier = async (user, reward) => (
  shouldUseServerEconomy(user)
    ? claimRewardMultiplierServer(reward)
    : mutateEconomy(user, (state) => applyRewardMultiplier(state, reward))
);

export const purchasePieceSkin = async (user, pieceSkinId) => (
  shouldUseServerEconomy(user)
    ? purchasePieceSkinServer(pieceSkinId)
    : mutateEconomy(user, (state) => applyPieceSkinPurchase(state, pieceSkinId))
);

export const reservePublicMatchEntry = async (user, matchId, now = Date.now()) => (
  shouldUseServerEconomy(user)
    ? reservePublicMatchEntryServer(matchId)
    : mutateEconomy(user, (state) => applyPublicEntry(state, matchId, now))
);

export const settlePublicMatch = async (user, settlement) => (
  shouldUseServerEconomy(user)
    ? settlePublicMatchServer(settlement)
    : mutateEconomy(user, (state) => applyPublicSettlement(state, settlement))
);

export const refundPublicMatchEntry = async (user, matchId, reason, now = Date.now()) => (
  shouldUseServerEconomy(user)
    ? refundPublicMatchEntryServer(matchId, reason)
    : mutateEconomy(user, (state) => applyPublicMatchRefund(state, matchId, reason, now))
);

export const getQaEconomyStorageKey = () => `${LOCAL_ECONOMY_PREFIX}qa-user`;

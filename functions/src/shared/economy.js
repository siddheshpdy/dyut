export const PUBLIC_MATCH_ENTRY_COINS = process.env.CG_ENABLE_ADS === 'true' ? 500 : 200;
export const DAILY_LOGIN_REWARD_COINS = 500;
export const MATCH_FEE_BPS = 1000;
export const MAX_ECONOMY_EVENTS = 200;

export const GOAL_DEFINITIONS = Object.freeze([
  { id: 'daily-win', scope: 'daily', metric: 'wins', target: 1, reward: 100 },
  { id: 'daily-capture', scope: 'daily', metric: 'captures', target: 3, reward: 75 },
  { id: 'weekly-win', scope: 'weekly', metric: 'wins', target: 3, reward: 300 },
  { id: 'weekly-capture', scope: 'weekly', metric: 'captures', target: 10, reward: 500 },
]);

export const ECONOMY_EVENT_TYPES = Object.freeze({
  DAILY_LOGIN: 'daily_login',
  PUBLIC_ENTRY: 'public_entry',
  PUBLIC_PRIZE: 'public_prize',
  PUBLIC_LOSS: 'public_loss',
  PUBLIC_REFUND: 'public_refund',
  GOAL_PROGRESS: 'goal_progress',
  GOAL_REWARD: 'goal_reward',
  REWARDED_MULTIPLIER: 'rewarded_multiplier',
  COSMETIC_PURCHASE: 'cosmetic_purchase',
});

export class EconomyCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const safeInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getUtcDayKey = (value = Date.now()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new EconomyCommandError('invalid-argument', 'Invalid reward date.');
  return date.toISOString().slice(0, 10);
};

export const getUtcWeekKey = (value = Date.now()) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new EconomyCommandError('invalid-argument', 'Invalid reward date.');
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return getUtcDayKey(date);
};

const normalizeSkinIds = (ids) => [...new Set(['classic', ...(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && [
  'classic', 'lotus', 'chakra', 'royal', 'conch', 'peacock', 'eclipse', 'temple', 'celestial',
].includes(id)) : [])])];

export const normalizeEconomyState = (value = {}) => ({
  coins: safeInteger(value.coins),
  ownedPieceSkinIds: normalizeSkinIds(value.ownedPieceSkinIds),
  lastDailyRewardDay: typeof value.lastDailyRewardDay === 'string' ? value.lastDailyRewardDay : null,
  events: value.events && typeof value.events === 'object' && !Array.isArray(value.events) ? value.events : {},
  goalProgress: {
    daily: {
      periodKey: typeof value.goalProgress?.daily?.periodKey === 'string' ? value.goalProgress.daily.periodKey : null,
      wins: safeInteger(value.goalProgress?.daily?.wins),
      captures: safeInteger(value.goalProgress?.daily?.captures),
      claimed: value.goalProgress?.daily?.claimed && typeof value.goalProgress.daily.claimed === 'object' ? value.goalProgress.daily.claimed : {},
    },
    weekly: {
      periodKey: typeof value.goalProgress?.weekly?.periodKey === 'string' ? value.goalProgress.weekly.periodKey : null,
      wins: safeInteger(value.goalProgress?.weekly?.wins),
      captures: safeInteger(value.goalProgress?.weekly?.captures),
      claimed: value.goalProgress?.weekly?.claimed && typeof value.goalProgress.weekly.claimed === 'object' ? value.goalProgress.weekly.claimed : {},
    },
  },
  version: 1,
});

const currentPeriods = (stateValue, now) => {
  const state = normalizeEconomyState(stateValue);
  const dailyKey = getUtcDayKey(now);
  const weeklyKey = getUtcWeekKey(now);
  const daily = state.goalProgress.daily.periodKey === dailyKey
    ? state.goalProgress.daily
    : { periodKey: dailyKey, wins: 0, captures: 0, claimed: {} };
  const weekly = state.goalProgress.weekly.periodKey === weeklyKey
    ? state.goalProgress.weekly
    : { periodKey: weeklyKey, wins: 0, captures: 0, claimed: {} };
  return { ...state, goalProgress: { daily, weekly } };
};

export const getRewardGoals = (stateValue, now = Date.now()) => {
  const state = currentPeriods(stateValue, now);
  return GOAL_DEFINITIONS.map((definition) => {
    const bucket = state.goalProgress[definition.scope];
    const progress = Math.min(bucket[definition.metric], definition.target);
    const claimed = Boolean(bucket.claimed[definition.id]);
    return { ...definition, periodKey: bucket.periodKey, progress, completed: progress >= definition.target, claimed, claimable: progress >= definition.target && !claimed };
  });
};

const trimEvents = (events) => Object.fromEntries(
  Object.entries(events)
    .sort(([, left], [, right]) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
    .slice(0, MAX_ECONOMY_EVENTS),
);

const applyEvent = (stateValue, eventId, event) => {
  const state = normalizeEconomyState(stateValue);
  if (state.events[eventId]) return { state, event: state.events[eventId], applied: false, eventId };
  const delta = Number(event.delta);
  if (!Number.isSafeInteger(delta)) throw new EconomyCommandError('invalid-argument', 'Economy deltas must be safe integers.');
  const nextCoins = state.coins + delta;
  if (!Number.isSafeInteger(nextCoins) || nextCoins < 0) throw new EconomyCommandError('failed-precondition', 'Insufficient Temple Coins.');
  const storedEvent = { ...event, delta, balanceAfter: nextCoins, createdAt: Number(event.createdAt) || Date.now() };
  return {
    state: { ...state, coins: nextCoins, events: trimEvents({ ...state.events, [eventId]: storedEvent }) },
    event: storedEvent,
    applied: true,
    eventId,
  };
};

export const applyDailyLoginReward = (stateValue, now = Date.now()) => {
  const dayKey = getUtcDayKey(now);
  const result = applyEvent(stateValue, `daily:${dayKey}`, { type: ECONOMY_EVENT_TYPES.DAILY_LOGIN, delta: DAILY_LOGIN_REWARD_COINS, dayKey, createdAt: now });
  return { ...result, state: { ...result.state, lastDailyRewardDay: dayKey } };
};

export const recordOnlineGoalProgress = (stateValue, { matchId, didWin = false, captures = 0, now = Date.now() }) => {
  if (!matchId) throw new EconomyCommandError('invalid-argument', 'A match ID is required.');
  const state = currentPeriods(stateValue, now);
  const captureCount = safeInteger(captures);
  const result = applyEvent(state, `goal-progress:${matchId}`, { type: ECONOMY_EVENT_TYPES.GOAL_PROGRESS, delta: 0, matchId, wins: didWin ? 1 : 0, captures: captureCount, createdAt: now });
  if (!result.applied) return result;
  const update = (bucket) => ({ ...bucket, wins: bucket.wins + (didWin ? 1 : 0), captures: bucket.captures + captureCount });
  return { ...result, state: { ...result.state, goalProgress: { daily: update(result.state.goalProgress.daily), weekly: update(result.state.goalProgress.weekly) } } };
};

export const claimGoalReward = (stateValue, { goalId, now = Date.now() }) => {
  if (!goalId) throw new EconomyCommandError('invalid-argument', 'A goal ID is required.');
  const state = currentPeriods(stateValue, now);
  const goal = getRewardGoals(state, now).find((candidate) => candidate.id === goalId);
  if (!goal) throw new EconomyCommandError('not-found', 'Unknown reward goal.');
  const eventId = `goal-claim:${goal.periodKey}:${goal.id}`;
  if (state.events[eventId]) return { state, event: state.events[eventId], applied: false, eventId, goal };
  if (!goal.claimable) throw new EconomyCommandError('failed-precondition', goal.claimed ? 'Reward goal was already claimed.' : 'Reward goal is not complete.');
  const result = applyEvent(state, eventId, { type: ECONOMY_EVENT_TYPES.GOAL_REWARD, delta: goal.reward, goalId: goal.id, periodKey: goal.periodKey, createdAt: now });
  return {
    ...result,
    goal,
    state: {
      ...result.state,
      goalProgress: {
        ...result.state.goalProgress,
        [goal.scope]: { ...result.state.goalProgress[goal.scope], claimed: { ...result.state.goalProgress[goal.scope].claimed, [goal.id]: true } },
      },
    },
  };
};

export const claimRewardMultiplier = (stateValue, { sourceEventId, multiplier = 2, now = Date.now() }) => {
  const state = normalizeEconomyState(stateValue);
  const sourceEvent = state.events[sourceEventId];
  const numericMultiplier = Number(multiplier);
  if (!sourceEvent || sourceEvent.delta <= 0 || ![ECONOMY_EVENT_TYPES.DAILY_LOGIN, ECONOMY_EVENT_TYPES.GOAL_REWARD].includes(sourceEvent.type)) throw new EconomyCommandError('not-found', 'The reward is not eligible for a multiplier.');
  if (!Number.isSafeInteger(numericMultiplier) || numericMultiplier < 2 || numericMultiplier > 5) throw new EconomyCommandError('invalid-argument', 'Reward multiplier must be between 2 and 5.');
  const eventId = `reward-multiplier:${sourceEventId}`;
  if (state.events[eventId]) return { state, event: state.events[eventId], applied: false, eventId };
  return applyEvent(state, eventId, { type: ECONOMY_EVENT_TYPES.REWARDED_MULTIPLIER, delta: sourceEvent.delta * (numericMultiplier - 1), sourceEventId, multiplier: numericMultiplier, createdAt: now });
};

const skins = Object.freeze({ lotus: 750, chakra: 1200, royal: 2000, conch: 3000, peacock: 4500, eclipse: 6500, temple: 9000, celestial: 12000 });

export const isKnownPieceSkinId = (pieceSkinId) => (
  pieceSkinId === 'classic' || Object.prototype.hasOwnProperty.call(skins, pieceSkinId)
);

export const isPieceSkinOwned = (pieceSkinId, ownedPieceSkinIds) => (
  isKnownPieceSkinId(pieceSkinId)
  && normalizeSkinIds(ownedPieceSkinIds).includes(pieceSkinId)
);

export const purchasePieceSkin = (stateValue, pieceSkinId, now = Date.now()) => {
  if (!Object.prototype.hasOwnProperty.call(skins, pieceSkinId)) throw new EconomyCommandError('not-found', 'Unknown piece design.');
  const state = normalizeEconomyState(stateValue);
  const eventId = `cosmetic-purchase:${pieceSkinId}`;
  if (state.ownedPieceSkinIds.includes(pieceSkinId)) return { state, event: state.events[eventId] || null, applied: false, eventId };
  const result = applyEvent(state, eventId, { type: ECONOMY_EVENT_TYPES.COSMETIC_PURCHASE, delta: -skins[pieceSkinId], pieceSkinId, createdAt: now });
  return { ...result, state: { ...result.state, ownedPieceSkinIds: [...result.state.ownedPieceSkinIds, pieceSkinId] } };
};

export const reservePublicMatchEntry = (stateValue, matchId, now = Date.now()) => {
  if (!matchId) throw new EconomyCommandError('invalid-argument', 'A match ID is required.');
  return applyEvent(stateValue, `entry:${matchId}`, { type: ECONOMY_EVENT_TYPES.PUBLIC_ENTRY, delta: -PUBLIC_MATCH_ENTRY_COINS, matchId, createdAt: now });
};

export const calculatePublicMatchPool = (participantCount) => {
  const count = Number(participantCount);
  if (!Number.isSafeInteger(count) || count < 2) throw new EconomyCommandError('invalid-argument', 'At least two paid participants are required.');
  const grossPool = PUBLIC_MATCH_ENTRY_COINS * count;
  const matchFee = Math.floor((grossPool * MATCH_FEE_BPS) / 10000);
  return { participantCount: count, entryPerPlayer: PUBLIC_MATCH_ENTRY_COINS, grossPool, matchFeeBps: MATCH_FEE_BPS, matchFee, winnerPrize: grossPool - matchFee, loserPrize: 0 };
};

export const settlePublicMatch = (stateValue, { matchId, participantCount, didWin = false, isDraw = false, winnerCount = 1, now = Date.now() }) => {
  if (!matchId) throw new EconomyCommandError('invalid-argument', 'A match ID is required.');
  const state = normalizeEconomyState(stateValue);
  if (!state.events[`entry:${matchId}`]) throw new EconomyCommandError('failed-precondition', 'Public match entry was not reserved.');
  const pool = calculatePublicMatchPool(participantCount);
  const winners = Number(winnerCount);
  if (!Number.isSafeInteger(winners) || winners < 1 || winners > pool.participantCount) throw new EconomyCommandError('invalid-argument', 'Invalid winner count.');
  const prizePerWinner = Math.floor(pool.winnerPrize / winners);
  const delta = isDraw ? PUBLIC_MATCH_ENTRY_COINS : didWin ? prizePerWinner : 0;
  const eventId = `settlement:${matchId}`;
  const result = applyEvent(state, eventId, { type: isDraw ? ECONOMY_EVENT_TYPES.PUBLIC_REFUND : didWin ? ECONOMY_EVENT_TYPES.PUBLIC_PRIZE : ECONOMY_EVENT_TYPES.PUBLIC_LOSS, delta, matchId, ...pool, winnerCount: winners, prizePerWinner, didWin: Boolean(didWin), isDraw: Boolean(isDraw), createdAt: now });
  return { ...result, settlement: { ...pool, winnerCount: winners, prizePerWinner, didWin: Boolean(didWin), isDraw: Boolean(isDraw), payout: delta } };
};

export const refundPublicMatchEntry = (stateValue, matchId, reason = 'match_not_started', now = Date.now()) => {
  const state = normalizeEconomyState(stateValue);
  if (!state.events[`entry:${matchId}`]) throw new EconomyCommandError('failed-precondition', 'Public match entry was not reserved.');
  const result = applyEvent(state, `refund:${matchId}`, { type: ECONOMY_EVENT_TYPES.PUBLIC_REFUND, delta: PUBLIC_MATCH_ENTRY_COINS, matchId, reason, createdAt: now });
  return {
    ...result,
    // A failed start must be retryable with the same match ID. The immutable
    // ledger retains the refund, while the live wallet state no longer treats
    // the old reservation as active.
    state: {
      ...result.state,
      events: Object.fromEntries(Object.entries(result.state.events).filter(([eventId]) => eventId !== `entry:${matchId}`)),
    },
  };
};

import { getPieceSkin, normalizeOwnedPieceSkinIds, PIECE_SKINS } from './pieceSkins.js';

const CRAZYGAMES_ADS_ENABLED = import.meta.env.VITE_CG_ENABLE_ADS === 'true';

export const PUBLIC_MATCH_ENTRY_COINS = CRAZYGAMES_ADS_ENABLED ? 500 : 200;
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

const toSafeInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getUtcDayKey = (value = Date.now()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid daily reward date');
  return date.toISOString().slice(0, 10);
};

export const getUtcWeekKey = (value = Date.now()) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid weekly reward date');
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return getUtcDayKey(date);
};

export const requiresPublicMatchEntry = ({ isOnline = false, isPublic = false } = {}) => (
  Boolean(isOnline && isPublic)
);

export const normalizeEconomyState = (value = {}) => ({
  coins: toSafeInteger(value?.coins),
  ownedPieceSkinIds: normalizeOwnedPieceSkinIds(value?.ownedPieceSkinIds),
  lastDailyRewardDay: typeof value?.lastDailyRewardDay === 'string'
    ? value.lastDailyRewardDay
    : null,
  events: value?.events && typeof value.events === 'object' && !Array.isArray(value.events)
    ? { ...value.events }
    : {},
  goalProgress: {
    daily: {
      periodKey: typeof value?.goalProgress?.daily?.periodKey === 'string'
        ? value.goalProgress.daily.periodKey
        : null,
      wins: toSafeInteger(value?.goalProgress?.daily?.wins),
      captures: toSafeInteger(value?.goalProgress?.daily?.captures),
      claimed: value?.goalProgress?.daily?.claimed && typeof value.goalProgress.daily.claimed === 'object'
        ? { ...value.goalProgress.daily.claimed }
        : {},
    },
    weekly: {
      periodKey: typeof value?.goalProgress?.weekly?.periodKey === 'string'
        ? value.goalProgress.weekly.periodKey
        : null,
      wins: toSafeInteger(value?.goalProgress?.weekly?.wins),
      captures: toSafeInteger(value?.goalProgress?.weekly?.captures),
      claimed: value?.goalProgress?.weekly?.claimed && typeof value.goalProgress.weekly.claimed === 'object'
        ? { ...value.goalProgress.weekly.claimed }
        : {},
    },
  },
  version: 1,
});

const getCurrentGoalProgress = (stateValue, now = Date.now()) => {
  const state = normalizeEconomyState(stateValue);
  const dailyPeriodKey = getUtcDayKey(now);
  const weeklyPeriodKey = getUtcWeekKey(now);
  const daily = state.goalProgress.daily.periodKey === dailyPeriodKey
    ? state.goalProgress.daily
    : { periodKey: dailyPeriodKey, wins: 0, captures: 0, claimed: {} };
  const weekly = state.goalProgress.weekly.periodKey === weeklyPeriodKey
    ? state.goalProgress.weekly
    : { periodKey: weeklyPeriodKey, wins: 0, captures: 0, claimed: {} };

  return { ...state, goalProgress: { daily, weekly } };
};

export const getRewardGoals = (stateValue, now = Date.now()) => {
  const state = getCurrentGoalProgress(stateValue, now);
  return GOAL_DEFINITIONS.map((definition) => {
    const progressBucket = state.goalProgress[definition.scope];
    const progress = Math.min(progressBucket[definition.metric], definition.target);
    const claimed = Boolean(progressBucket.claimed[definition.id]);
    return {
      ...definition,
      periodKey: progressBucket.periodKey,
      progress,
      completed: progress >= definition.target,
      claimed,
      claimable: progress >= definition.target && !claimed,
    };
  });
};

export const recordOnlineGoalProgress = (
  stateValue,
  { matchId, didWin = false, captures = 0, now = Date.now() },
) => {
  if (!matchId) throw new Error('A match ID is required to record goal progress');
  const captureCount = toSafeInteger(captures);
  const state = getCurrentGoalProgress(stateValue, now);
  const eventId = `goal-progress:${matchId}`;
  const result = applyEvent(state, eventId, {
    type: ECONOMY_EVENT_TYPES.GOAL_PROGRESS,
    delta: 0,
    matchId,
    wins: didWin ? 1 : 0,
    captures: captureCount,
    createdAt: now instanceof Date ? now.getTime() : now,
  });

  if (!result.applied) return { ...result, eventId };

  const updateBucket = (bucket) => ({
    ...bucket,
    wins: bucket.wins + (didWin ? 1 : 0),
    captures: bucket.captures + captureCount,
  });
  return {
    ...result,
    eventId,
    state: {
      ...result.state,
      goalProgress: {
        daily: updateBucket(result.state.goalProgress.daily),
        weekly: updateBucket(result.state.goalProgress.weekly),
      },
    },
  };
};

export const claimGoalReward = (
  stateValue,
  { goalId, now = Date.now() },
) => {
  if (!goalId) throw new Error('A goal ID is required to claim a goal reward');
  const state = getCurrentGoalProgress(stateValue, now);
  const goal = getRewardGoals(state, now).find((candidate) => candidate.id === goalId);
  if (!goal) throw new Error('Unknown reward goal');
  const eventId = `goal-claim:${goal.periodKey}:${goal.id}`;
  if (state.events[eventId]) {
    return { state, event: state.events[eventId], applied: false, eventId, goal };
  }
  if (!goal.claimable) {
    const error = new Error(goal.claimed ? 'Reward goal was already claimed' : 'Reward goal is not complete');
    error.code = goal.claimed ? 'goal-already-claimed' : 'goal-not-complete';
    throw error;
  }

  const result = applyEvent(state, eventId, {
    type: ECONOMY_EVENT_TYPES.GOAL_REWARD,
    delta: goal.reward,
    goalId: goal.id,
    periodKey: goal.periodKey,
    createdAt: now instanceof Date ? now.getTime() : now,
  });
  return {
    ...result,
    eventId,
    goal,
    state: {
      ...result.state,
      goalProgress: {
        ...result.state.goalProgress,
        [goal.scope]: {
          ...result.state.goalProgress[goal.scope],
          claimed: {
            ...result.state.goalProgress[goal.scope].claimed,
            [goal.id]: true,
          },
        },
      },
    },
  };
};

export const claimRewardMultiplier = (
  stateValue,
  { sourceEventId, multiplier = 2, now = Date.now() },
) => {
  if (!sourceEventId) throw new Error('A reward event is required for a multiplier');
  const numericMultiplier = Number(multiplier);
  if (!Number.isSafeInteger(numericMultiplier) || numericMultiplier < 2 || numericMultiplier > 5) {
    throw new Error('Reward multiplier must be an integer between 2 and 5');
  }
  const state = normalizeEconomyState(stateValue);
  const sourceEvent = state.events[sourceEventId];
  const multiplierEligibleTypes = new Set([
    ECONOMY_EVENT_TYPES.DAILY_LOGIN,
    ECONOMY_EVENT_TYPES.GOAL_REWARD,
  ]);
  if (!sourceEvent || sourceEvent.delta <= 0 || !multiplierEligibleTypes.has(sourceEvent.type)) {
    const error = new Error('The reward is not eligible for a multiplier');
    error.code = 'reward-not-found';
    throw error;
  }
  const eventId = `reward-multiplier:${sourceEventId}`;
  if (state.events[eventId]) return { state, event: state.events[eventId], applied: false, eventId };
  return {
    ...applyEvent(state, eventId, {
      type: ECONOMY_EVENT_TYPES.REWARDED_MULTIPLIER,
      delta: sourceEvent.delta * (numericMultiplier - 1),
      sourceEventId,
      multiplier: numericMultiplier,
      createdAt: now instanceof Date ? now.getTime() : now,
    }),
    eventId,
  };
};

const trimEvents = (events) => {
  const entries = Object.entries(events);
  if (entries.length <= MAX_ECONOMY_EVENTS) return events;

  return Object.fromEntries(
    entries
      .sort(([, left], [, right]) => (Number(right?.createdAt) || 0) - (Number(left?.createdAt) || 0))
      .slice(0, MAX_ECONOMY_EVENTS),
  );
};

const applyEvent = (stateValue, eventId, event) => {
  const state = normalizeEconomyState(stateValue);
  const existingEvent = state.events[eventId];
  if (existingEvent) {
    return {
      state,
      event: existingEvent,
      applied: false,
    };
  }

  const delta = Number(event.delta);
  if (!Number.isSafeInteger(delta)) throw new Error('Economy deltas must be safe integers');

  const nextCoins = state.coins + delta;
  if (!Number.isSafeInteger(nextCoins) || nextCoins < 0) {
    const error = new Error('Insufficient Temple Coins');
    error.code = 'insufficient-coins';
    throw error;
  }

  const storedEvent = {
    ...event,
    delta,
    balanceAfter: nextCoins,
    createdAt: Number(event.createdAt) || Date.now(),
  };

  return {
    state: {
      ...state,
      coins: nextCoins,
      events: trimEvents({
        ...state.events,
        [eventId]: storedEvent,
      }),
    },
    event: storedEvent,
    applied: true,
  };
};

export const applyDailyLoginReward = (stateValue, now = Date.now()) => {
  const dayKey = getUtcDayKey(now);
  const eventId = `daily:${dayKey}`;
  const result = applyEvent(stateValue, eventId, {
    type: ECONOMY_EVENT_TYPES.DAILY_LOGIN,
    delta: DAILY_LOGIN_REWARD_COINS,
    dayKey,
    createdAt: now instanceof Date ? now.getTime() : now,
  });

  return {
    ...result,
    eventId,
    state: {
      ...result.state,
      lastDailyRewardDay: dayKey,
    },
  };
};

export const purchasePieceSkin = (stateValue, pieceSkinId, now = Date.now()) => {
  const skin = PIECE_SKINS.find((candidate) => candidate.id === pieceSkinId);
  if (!skin) {
    const error = new Error('Unknown piece design');
    error.code = 'unknown-piece-skin';
    throw error;
  }

  const state = normalizeEconomyState(stateValue);
  const eventId = `cosmetic-purchase:${skin.id}`;
  if (state.ownedPieceSkinIds.includes(skin.id)) {
    return { state, event: state.events[eventId] || null, applied: false, eventId };
  }
  if (skin.acquisition !== 'coins') {
    const error = new Error('Piece design is not for sale');
    error.code = 'piece-skin-not-for-sale';
    throw error;
  }

  const result = applyEvent(state, eventId, {
    type: ECONOMY_EVENT_TYPES.COSMETIC_PURCHASE,
    delta: -skin.price,
    pieceSkinId: skin.id,
    createdAt: now instanceof Date ? now.getTime() : now,
  });
  return {
    ...result,
    eventId,
    state: {
      ...result.state,
      ownedPieceSkinIds: normalizeOwnedPieceSkinIds([...result.state.ownedPieceSkinIds, skin.id]),
    },
  };
};

export const reservePublicMatchEntry = (stateValue, matchId, now = Date.now()) => {
  if (!matchId) throw new Error('A match ID is required to reserve an entry');
  const eventId = `entry:${matchId}`;
  return {
    ...applyEvent(stateValue, eventId, {
      type: ECONOMY_EVENT_TYPES.PUBLIC_ENTRY,
      delta: -PUBLIC_MATCH_ENTRY_COINS,
      matchId,
      createdAt: now,
    }),
    eventId,
  };
};

export const calculatePublicMatchPool = (participantCount) => {
  const players = Number(participantCount);
  if (!Number.isSafeInteger(players) || players < 2) {
    throw new Error('A public match pool requires at least two paid participants');
  }

  const grossPool = PUBLIC_MATCH_ENTRY_COINS * players;
  const matchFee = Math.floor((grossPool * MATCH_FEE_BPS) / 10_000);

  return {
    participantCount: players,
    entryPerPlayer: PUBLIC_MATCH_ENTRY_COINS,
    grossPool,
    matchFeeBps: MATCH_FEE_BPS,
    matchFee,
    winnerPrize: grossPool - matchFee,
    loserPrize: 0,
  };
};

export const settlePublicMatch = (
  stateValue,
  {
    matchId,
    participantCount,
    didWin = false,
    isDraw = false,
    winnerCount = 1,
    now = Date.now(),
  },
) => {
  if (!matchId) throw new Error('A match ID is required to settle a match');

  const state = normalizeEconomyState(stateValue);
  const entryEvent = state.events[`entry:${matchId}`];
  if (!entryEvent) {
    const error = new Error('Public match entry was not reserved');
    error.code = 'entry-not-reserved';
    throw error;
  }

  const pool = calculatePublicMatchPool(participantCount);
  const winners = Number(winnerCount);
  if (!Number.isSafeInteger(winners) || winners < 1 || winners > pool.participantCount) {
    throw new Error('Winner count must be between one and the paid participant count');
  }
  const prizePerWinner = Math.floor(pool.winnerPrize / winners);
  const eventId = `settlement:${matchId}`;
  const type = isDraw
    ? ECONOMY_EVENT_TYPES.PUBLIC_REFUND
    : didWin
      ? ECONOMY_EVENT_TYPES.PUBLIC_PRIZE
      : ECONOMY_EVENT_TYPES.PUBLIC_LOSS;
  const delta = isDraw
    ? PUBLIC_MATCH_ENTRY_COINS
    : didWin
      ? prizePerWinner
      : 0;

  return {
    ...applyEvent(state, eventId, {
      type,
      delta,
      matchId,
      ...pool,
      winnerCount: winners,
      prizePerWinner,
      didWin: Boolean(didWin),
      isDraw: Boolean(isDraw),
      createdAt: now,
    }),
    eventId,
    settlement: {
      ...pool,
      winnerCount: winners,
      prizePerWinner,
      didWin: Boolean(didWin),
      isDraw: Boolean(isDraw),
      payout: delta,
    },
  };
};

export const refundPublicMatchEntry = (stateValue, matchId, reason = 'match_not_started', now = Date.now()) => {
  if (!matchId) throw new Error('A match ID is required to refund an entry');
  const state = normalizeEconomyState(stateValue);
  if (!state.events[`entry:${matchId}`]) {
    const error = new Error('Public match entry was not reserved');
    error.code = 'entry-not-reserved';
    throw error;
  }

  const eventId = `refund:${matchId}`;
  return {
    ...applyEvent(state, eventId, {
      type: ECONOMY_EVENT_TYPES.PUBLIC_REFUND,
      delta: PUBLIC_MATCH_ENTRY_COINS,
      matchId,
      reason,
      createdAt: now,
    }),
    eventId,
  };
};

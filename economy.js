export const PUBLIC_MATCH_ENTRY_COINS = 500;
export const DAILY_LOGIN_REWARD_COINS = 500;
export const MATCH_FEE_BPS = 1000;
export const MAX_ECONOMY_EVENTS = 200;

export const ECONOMY_EVENT_TYPES = Object.freeze({
  DAILY_LOGIN: 'daily_login',
  PUBLIC_ENTRY: 'public_entry',
  PUBLIC_PRIZE: 'public_prize',
  PUBLIC_LOSS: 'public_loss',
  PUBLIC_REFUND: 'public_refund',
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

export const requiresPublicMatchEntry = ({ isOnline = false, isPublic = false } = {}) => (
  Boolean(isOnline && isPublic)
);

export const normalizeEconomyState = (value = {}) => ({
  coins: toSafeInteger(value?.coins),
  lastDailyRewardDay: typeof value?.lastDailyRewardDay === 'string'
    ? value.lastDailyRewardDay
    : null,
  events: value?.events && typeof value.events === 'object' && !Array.isArray(value.events)
    ? { ...value.events }
    : {},
  version: 1,
});

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
  const eventId = `settlement:${matchId}`;
  const type = isDraw
    ? ECONOMY_EVENT_TYPES.PUBLIC_REFUND
    : didWin
      ? ECONOMY_EVENT_TYPES.PUBLIC_PRIZE
      : ECONOMY_EVENT_TYPES.PUBLIC_LOSS;
  const delta = isDraw
    ? PUBLIC_MATCH_ENTRY_COINS
    : didWin
      ? pool.winnerPrize
      : 0;

  return {
    ...applyEvent(state, eventId, {
      type,
      delta,
      matchId,
      ...pool,
      didWin: Boolean(didWin),
      isDraw: Boolean(isDraw),
      createdAt: now,
    }),
    eventId,
    settlement: {
      ...pool,
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

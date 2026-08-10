import { describe, expect, it } from 'vitest';
import {
  DAILY_LOGIN_REWARD_COINS,
  getRewardGoals,
  MATCH_FEE_BPS,
  PUBLIC_MATCH_ENTRY_COINS,
  applyDailyLoginReward,
  calculatePublicMatchPool,
  normalizeEconomyState,
  claimGoalReward,
  claimRewardMultiplier,
  recordOnlineGoalProgress,
  requiresPublicMatchEntry,
  purchasePieceSkin,
  reservePublicMatchEntry,
  settlePublicMatch,
} from './economy';

describe('Temple Coin economy', () => {
  it('grants 500 coins once per UTC day', () => {
    const first = applyDailyLoginReward({}, Date.parse('2026-07-27T08:00:00Z'));
    const repeated = applyDailyLoginReward(first.state, Date.parse('2026-07-27T22:00:00Z'));
    const nextDay = applyDailyLoginReward(repeated.state, Date.parse('2026-07-28T00:00:00Z'));

    expect(DAILY_LOGIN_REWARD_COINS).toBe(500);
    expect(first.applied).toBe(true);
    expect(first.state.coins).toBe(500);
    expect(repeated.applied).toBe(false);
    expect(repeated.state.coins).toBe(500);
    expect(nextDay.applied).toBe(true);
    expect(nextDay.state.coins).toBe(1000);
  });

  it('reserves the ads-disabled 200-coin public entry exactly once', () => {
    const startingState = normalizeEconomyState({ coins: PUBLIC_MATCH_ENTRY_COINS });
    const first = reservePublicMatchEntry(startingState, 'MATCH1', 1);
    const repeated = reservePublicMatchEntry(first.state, 'MATCH1', 2);

    expect(PUBLIC_MATCH_ENTRY_COINS).toBe(200);
    expect(first.applied).toBe(true);
    expect(first.state.coins).toBe(0);
    expect(repeated.applied).toBe(false);
    expect(repeated.state.coins).toBe(0);
  });

  it('charges only public online play and keeps offline, friends, and Instant rooms free', () => {
    expect(requiresPublicMatchEntry({ isOnline: true, isPublic: true })).toBe(true);
    expect(requiresPublicMatchEntry({ isOnline: false, isPublic: false })).toBe(false);
    expect(requiresPublicMatchEntry({ isOnline: true, isPublic: false })).toBe(false);
    expect(requiresPublicMatchEntry({ isOnline: false, isPublic: true })).toBe(false);
  });

  it('rejects public entry below the current entry cost', () => {
    expect(() => reservePublicMatchEntry({ coins: PUBLIC_MATCH_ENTRY_COINS - 1 }, 'MATCH1')).toThrowError(
      expect.objectContaining({ code: 'insufficient-coins' }),
    );
  });

  it('purchases a piece design once and records ownership', () => {
    const first = purchasePieceSkin({ coins: 750 }, 'lotus', 1);
    const repeated = purchasePieceSkin(first.state, 'lotus', 2);

    expect(first.applied).toBe(true);
    expect(first.state.coins).toBe(0);
    expect(first.state.ownedPieceSkinIds).toEqual(['classic', 'lotus']);
    expect(repeated.applied).toBe(false);
    expect(repeated.state.coins).toBe(0);
  });

  it('calculates the 10% fee and 90% winner prize', () => {
    expect(MATCH_FEE_BPS).toBe(1000);
    expect(calculatePublicMatchPool(2)).toEqual({
      participantCount: 2,
      entryPerPlayer: 200,
      grossPool: 400,
      matchFeeBps: 1000,
      matchFee: 40,
      winnerPrize: 360,
      loserPrize: 0,
    });
    expect(calculatePublicMatchPool(4)).toEqual({
      participantCount: 4,
      entryPerPlayer: 200,
      grossPool: 800,
      matchFeeBps: 1000,
      matchFee: 80,
      winnerPrize: 720,
      loserPrize: 0,
    });
  });

  it('awards the winner and gives the loser no pool payout', () => {
    const winnerEntry = reservePublicMatchEntry({ coins: 200 }, 'MATCH1');
    const loserEntry = reservePublicMatchEntry({ coins: 200 }, 'MATCH1');
    const winner = settlePublicMatch(winnerEntry.state, {
      matchId: 'MATCH1',
      participantCount: 2,
      didWin: true,
    });
    const loser = settlePublicMatch(loserEntry.state, {
      matchId: 'MATCH1',
      participantCount: 2,
      didWin: false,
    });

    expect(winner.state.coins).toBe(360);
    expect(winner.settlement.payout).toBe(360);
    expect(loser.state.coins).toBe(0);
    expect(loser.settlement.payout).toBe(0);
  });

  it('splits a four-player public 2v2 prize equally between the two winning teammates', () => {
    const winnerEntry = reservePublicMatchEntry({ coins: 200 }, 'TEAM-MATCH');
    const loserEntry = reservePublicMatchEntry({ coins: 200 }, 'TEAM-MATCH');
    const winner = settlePublicMatch(winnerEntry.state, {
      matchId: 'TEAM-MATCH',
      participantCount: 4,
      winnerCount: 2,
      didWin: true,
    });
    const loser = settlePublicMatch(loserEntry.state, {
      matchId: 'TEAM-MATCH',
      participantCount: 4,
      winnerCount: 2,
      didWin: false,
    });

    expect(winner.state.coins).toBe(360);
    expect(winner.settlement).toMatchObject({
      grossPool: 800,
      matchFee: 80,
      winnerPrize: 720,
      winnerCount: 2,
      prizePerWinner: 360,
      payout: 360,
    });
    expect(loser.state.coins).toBe(0);
    expect(loser.settlement.payout).toBe(0);
  });

  it('refunds the entry on a draw and keeps settlement idempotent', () => {
    const entry = reservePublicMatchEntry({ coins: 200 }, 'MATCH1');
    const draw = settlePublicMatch(entry.state, {
      matchId: 'MATCH1',
      participantCount: 2,
      isDraw: true,
    });
    const repeated = settlePublicMatch(draw.state, {
      matchId: 'MATCH1',
      participantCount: 2,
      isDraw: true,
    });

    expect(draw.state.coins).toBe(200);
    expect(draw.settlement.payout).toBe(200);
    expect(repeated.applied).toBe(false);
    expect(repeated.state.coins).toBe(200);
  });

  it('requires a reserved entry before settlement', () => {
    expect(() => settlePublicMatch({ coins: 500 }, {
      matchId: 'MATCH1',
      participantCount: 2,
      didWin: true,
    })).toThrowError(expect.objectContaining({ code: 'entry-not-reserved' }));
  });

  it('records daily and weekly goal progress without crediting coins automatically', () => {
    const progress = recordOnlineGoalProgress({}, {
      matchId: 'ONLINE-1',
      didWin: true,
      captures: 3,
      now: Date.parse('2026-07-28T12:00:00Z'),
    });
    const goals = getRewardGoals(progress.state, Date.parse('2026-07-28T12:00:00Z'));

    expect(progress.state.coins).toBe(0);
    expect(goals.find((goal) => goal.id === 'daily-win')).toMatchObject({
      progress: 1,
      claimable: true,
      reward: 100,
    });
    expect(goals.find((goal) => goal.id === 'daily-capture')).toMatchObject({
      progress: 3,
      claimable: true,
      reward: 75,
    });
    expect(goals.find((goal) => goal.id === 'weekly-win')).toMatchObject({ progress: 1, claimable: false });
  });

  it('claims a completed goal once and supports one idempotent ad multiplier', () => {
    const progress = recordOnlineGoalProgress({}, {
      matchId: 'ONLINE-2',
      didWin: true,
      now: Date.parse('2026-07-28T12:00:00Z'),
    });
    const claim = claimGoalReward(progress.state, {
      goalId: 'daily-win',
      now: Date.parse('2026-07-28T12:00:00Z'),
    });
    const repeatedClaim = claimGoalReward(claim.state, {
      goalId: 'daily-win',
      now: Date.parse('2026-07-28T12:00:00Z'),
    });
    const multiplier = claimRewardMultiplier(claim.state, {
      sourceEventId: claim.eventId,
      multiplier: 2,
      now: Date.parse('2026-07-28T12:00:00Z'),
    });
    const repeatedMultiplier = claimRewardMultiplier(multiplier.state, {
      sourceEventId: claim.eventId,
      multiplier: 2,
      now: Date.parse('2026-07-28T12:00:00Z'),
    });

    expect(claim.state.coins).toBe(100);
    expect(repeatedClaim.applied).toBe(false);
    expect(multiplier.state.coins).toBe(200);
    expect(repeatedMultiplier.applied).toBe(false);
    expect(() => claimGoalReward({}, { goalId: 'daily-win' }))
      .toThrowError(expect.objectContaining({ code: 'goal-not-complete' }));
  });
});

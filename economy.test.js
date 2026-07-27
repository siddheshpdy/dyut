import { describe, expect, it } from 'vitest';
import {
  DAILY_LOGIN_REWARD_COINS,
  MATCH_FEE_BPS,
  PUBLIC_MATCH_ENTRY_COINS,
  applyDailyLoginReward,
  calculatePublicMatchPool,
  normalizeEconomyState,
  requiresPublicMatchEntry,
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

  it('reserves a 500-coin public entry exactly once', () => {
    const startingState = normalizeEconomyState({ coins: 500 });
    const first = reservePublicMatchEntry(startingState, 'MATCH1', 1);
    const repeated = reservePublicMatchEntry(first.state, 'MATCH1', 2);

    expect(PUBLIC_MATCH_ENTRY_COINS).toBe(500);
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

  it('rejects public entry below 500 coins', () => {
    expect(() => reservePublicMatchEntry({ coins: 499 }, 'MATCH1')).toThrowError(
      expect.objectContaining({ code: 'insufficient-coins' }),
    );
  });

  it('calculates the 10% fee and 90% winner prize', () => {
    expect(MATCH_FEE_BPS).toBe(1000);
    expect(calculatePublicMatchPool(2)).toEqual({
      participantCount: 2,
      entryPerPlayer: 500,
      grossPool: 1000,
      matchFeeBps: 1000,
      matchFee: 100,
      winnerPrize: 900,
      loserPrize: 0,
    });
    expect(calculatePublicMatchPool(4)).toEqual({
      participantCount: 4,
      entryPerPlayer: 500,
      grossPool: 2000,
      matchFeeBps: 1000,
      matchFee: 200,
      winnerPrize: 1800,
      loserPrize: 0,
    });
  });

  it('awards the winner and gives the loser no pool payout', () => {
    const winnerEntry = reservePublicMatchEntry({ coins: 500 }, 'MATCH1');
    const loserEntry = reservePublicMatchEntry({ coins: 500 }, 'MATCH1');
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

    expect(winner.state.coins).toBe(900);
    expect(winner.settlement.payout).toBe(900);
    expect(loser.state.coins).toBe(0);
    expect(loser.settlement.payout).toBe(0);
  });

  it('splits a four-player public 2v2 prize equally between the two winning teammates', () => {
    const winnerEntry = reservePublicMatchEntry({ coins: 500 }, 'TEAM-MATCH');
    const loserEntry = reservePublicMatchEntry({ coins: 500 }, 'TEAM-MATCH');
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

    expect(winner.state.coins).toBe(900);
    expect(winner.settlement).toMatchObject({
      grossPool: 2000,
      matchFee: 200,
      winnerPrize: 1800,
      winnerCount: 2,
      prizePerWinner: 900,
      payout: 900,
    });
    expect(loser.state.coins).toBe(0);
    expect(loser.settlement.payout).toBe(0);
  });

  it('refunds the entry on a draw and keeps settlement idempotent', () => {
    const entry = reservePublicMatchEntry({ coins: 500 }, 'MATCH1');
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

    expect(draw.state.coins).toBe(500);
    expect(draw.settlement.payout).toBe(500);
    expect(repeated.applied).toBe(false);
    expect(repeated.state.coins).toBe(500);
  });

  it('requires a reserved entry before settlement', () => {
    expect(() => settlePublicMatch({ coins: 500 }, {
      matchId: 'MATCH1',
      participantCount: 2,
      didWin: true,
    })).toThrowError(expect.objectContaining({ code: 'entry-not-reserved' }));
  });
});

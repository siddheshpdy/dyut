import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EconomyCommandError,
  applyDailyLoginReward,
  claimGoalReward,
  isKnownPieceSkinId,
  isPieceSkinOwned,
  normalizeEconomyState,
  purchasePieceSkin,
  refundPublicMatchEntry,
  reservePublicMatchEntry,
  settlePublicMatch,
} from '../src/shared/economy.js';

test('daily reward is idempotent for the UTC day', () => {
  const first = applyDailyLoginReward(normalizeEconomyState(), Date.parse('2026-08-15T01:00:00Z'));
  const second = applyDailyLoginReward(first.state, Date.parse('2026-08-15T18:00:00Z'));
  assert.equal(first.state.coins, 500);
  assert.equal(second.applied, false);
  assert.equal(second.state.coins, 500);
});

test('cosmetic purchases validate balance and permanently add ownership', () => {
  const purchased = purchasePieceSkin({ coins: 1000 }, 'lotus', Date.now());
  assert.equal(purchased.state.coins, 250);
  assert.ok(purchased.state.ownedPieceSkinIds.includes('lotus'));
  assert.throws(() => purchasePieceSkin({ coins: 100 }, 'lotus'), (error) => {
    assert.ok(error instanceof EconomyCommandError);
    assert.equal(error.code, 'failed-precondition');
    return true;
  });
});

test('piece design entitlement checks reject unknown or unowned designs', () => {
  assert.equal(isKnownPieceSkinId('classic'), true);
  assert.equal(isKnownPieceSkinId('royal'), true);
  assert.equal(isKnownPieceSkinId('forged'), false);
  assert.equal(isPieceSkinOwned('classic', []), true);
  assert.equal(isPieceSkinOwned('royal', ['lotus']), false);
  assert.equal(isPieceSkinOwned('royal', ['royal']), true);
});

test('public entry is charged once for a match id', () => {
  const first = reservePublicMatchEntry({ coins: 500 }, 'MATCH-1');
  const second = reservePublicMatchEntry(first.state, 'MATCH-1');
  assert.equal(first.state.coins, 300);
  assert.equal(second.applied, false);
  assert.equal(second.state.coins, 300);
});

test('refunded public entry can be reserved again after a failed start', () => {
  const entry = reservePublicMatchEntry({ coins: 500 }, 'MATCH-RETRY');
  const refund = refundPublicMatchEntry(entry.state, 'MATCH-RETRY', 'lobby_start_failed');
  const retry = reservePublicMatchEntry(refund.state, 'MATCH-RETRY');
  assert.equal(refund.state.coins, 500);
  assert.equal(retry.applied, true);
  assert.equal(retry.state.coins, 300);
});

test('public settlement keeps the full pool when a paid player forfeits', () => {
  const winnerEntry = reservePublicMatchEntry({ coins: 500 }, 'FORFEIT-MATCH');
  const winner = settlePublicMatch(winnerEntry.state, {
    matchId: 'FORFEIT-MATCH',
    participantCount: 2,
    didWin: true,
    winnerCount: 1,
  });
  const loserEntry = reservePublicMatchEntry({ coins: 500 }, 'FORFEIT-MATCH');
  const loser = settlePublicMatch(loserEntry.state, {
    matchId: 'FORFEIT-MATCH',
    participantCount: 2,
    didWin: false,
    winnerCount: 1,
  });
  assert.equal(winner.state.coins, 660);
  assert.equal(loser.state.coins, 300);
  assert.equal(winner.settlement.winnerPrize, 360);
});

test('goal reward cannot be claimed before completion', () => {
  assert.throws(() => claimGoalReward(normalizeEconomyState(), { goalId: 'daily-win', now: Date.now() }), (error) => {
    assert.ok(error instanceof EconomyCommandError);
    assert.equal(error.code, 'failed-precondition');
    return true;
  });
});

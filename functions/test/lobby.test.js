import test from 'node:test';
import assert from 'node:assert/strict';
import { openSeatCount, sanitizeSeats, validateSeatId } from '../src/lobby/sanitization.js';

test('lobby sanitization never accepts browser-supplied seat ownership', () => {
  const existing = {
    Player1: { type: 'human', color: 'ruby', name: 'Host', uid: 'trusted-host' },
    Player2: { type: 'human', color: 'sapphire', name: '', uid: null },
    Player3: { type: 'closed', color: 'emerald', name: '', uid: null },
    Player4: { type: 'closed', color: 'amber', name: '', uid: null },
  };
  const requested = {
    ...existing,
    Player1: { ...existing.Player1, uid: 'attacker', name: 'Changed' },
    Player2: { ...existing.Player2, uid: 'another-attacker' },
  };
  const sanitized = sanitizeSeats(requested, existing);
  assert.equal(sanitized.Player1.uid, 'trusted-host');
  assert.equal(sanitized.Player2.uid, null);
  assert.equal(openSeatCount(sanitized), 1);
  const attemptedDemotion = sanitizeSeats({
    ...requested,
    Player1: { ...requested.Player1, type: 'bot' },
  }, existing);
  assert.equal(attemptedDemotion.Player1.uid, 'trusted-host');
  assert.equal(attemptedDemotion.Player1.type, 'human');
});

test('lobby sanitization validates fixed seat identifiers', () => {
  assert.equal(validateSeatId('Player3'), 'Player3');
  assert.throws(() => validateSeatId('Player9'), { code: 'invalid-argument' });
});

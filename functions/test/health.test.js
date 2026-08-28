import test from 'node:test';
import assert from 'node:assert/strict';

test('functions package test runner is available', () => {
  assert.equal(typeof test, 'function');
});

import { describe, expect, it } from 'vitest';
import { calculateMatchXp, createProgressionUpdate, getLevelForXp, getXpForLevel } from './progression.js';

describe('progression', () => {
  it('uses deterministic completion and win rewards', () => {
    expect(calculateMatchXp({ isWin: false })).toBe(25);
    expect(calculateMatchXp({ isWin: true })).toBe(100);
  });

  it('uses the documented increasing level curve', () => {
    expect(getXpForLevel(1)).toBe(0);
    expect(getXpForLevel(2)).toBe(100);
    expect(getXpForLevel(3)).toBe(250);
    expect(getLevelForXp(249)).toBe(2);
    expect(getLevelForXp(250)).toBe(3);
  });

  it('records each match only once when an id is available', () => {
    expect(createProgressionUpdate({ gamesPlayed: 1, wins: 1, xp: 100, completedMatchIds: ['match-1'] }, { isWin: true, matchId: 'match-1' })).toBeNull();
    expect(createProgressionUpdate({}, { isWin: true, matchId: 'match-2' })).toMatchObject({ gamesPlayed: 1, wins: 1, xp: 100, level: 2, coins: 100, ownedPieceSkinIds: ['classic'], completedMatchIds: ['match-2'] });
  });
});

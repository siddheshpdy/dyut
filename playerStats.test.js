import { describe, expect, it } from 'vitest';
import {
  getMatchStatMode,
  getPlayerModeStats,
  mergePlayerModeStats,
  normalizePlayerStats,
} from './playerStats.js';

describe('player stats', () => {
  it('keeps offline, public online, and private friend matches separate', () => {
    expect(getMatchStatMode({ isOnline: false })).toBe('offline');
    expect(getMatchStatMode({ isOnline: true, isPublic: true })).toBe('online');
    expect(getMatchStatMode({ isOnline: true, isPublic: false })).toBe('friends');
  });

  it('normalizes missing mode stats without losing aggregate stats', () => {
    const stats = normalizePlayerStats({ gamesPlayed: 4, wins: 2 });
    expect(stats).toMatchObject({ gamesPlayed: 4, wins: 2 });
    expect(getPlayerModeStats(stats, 'online')).toEqual({ gamesPlayed: 0, wins: 0 });
  });

  it('merges mode stats for account migration', () => {
    expect(mergePlayerModeStats(
      { online: { gamesPlayed: 2, wins: 1 } },
      { online: { gamesPlayed: 3, wins: 2 }, friends: { gamesPlayed: 1, wins: 1 } },
    )).toEqual({
      offline: { gamesPlayed: 0, wins: 0 },
      online: { gamesPlayed: 5, wins: 3 },
      friends: { gamesPlayed: 1, wins: 1 },
    });
  });
});

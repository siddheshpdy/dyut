import { describe, expect, it } from 'vitest';
import { parseCrazyGamesStoredValue, serializeCrazyGamesStoredValue } from './crazyGamesData';

describe('CrazyGames Data serialization', () => {
  it('parses JSON strings returned by the Data module', () => {
    expect(parseCrazyGamesStoredValue('{"gamesPlayed":2,"wins":1}')).toEqual({ gamesPlayed: 2, wins: 1 });
  });

  it('accepts object values returned by local SDK mocks', () => {
    const stats = { gamesPlayed: 2, wins: 1 };
    expect(parseCrazyGamesStoredValue(stats)).toBe(stats);
  });

  it('uses the fallback for legacy object-string and malformed values', () => {
    const fallback = { gamesPlayed: 0, wins: 0 };
    expect(parseCrazyGamesStoredValue('[object Object]', fallback)).toBe(fallback);
    expect(parseCrazyGamesStoredValue('{bad json', fallback)).toBe(fallback);
  });

  it('serializes values before writing them to the Data module', () => {
    expect(serializeCrazyGamesStoredValue({ gamesPlayed: 3, wins: 2 })).toBe('{"gamesPlayed":3,"wins":2}');
  });
});

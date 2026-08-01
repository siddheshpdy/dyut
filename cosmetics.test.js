import { describe, expect, it } from 'vitest';
import { DEFAULT_PIECE_SKIN_ID, FREE_PIECE_SKINS, getEquippedPieceSkinId, getPieceSkin, isPieceSkinUnlocked, normalizePieceSkinId } from './cosmetics.js';
import { createInitialState } from './GameContext.jsx';

describe('free piece skins', () => {
  it('exposes stable free catalog entries', () => {
    expect(FREE_PIECE_SKINS.map((skin) => skin.id)).toEqual(['classic', 'faceted']);
  });

  it('falls back safely for missing or unknown catalog IDs', () => {
    expect(normalizePieceSkinId()).toBe(DEFAULT_PIECE_SKIN_ID);
    expect(normalizePieceSkinId('unknown')).toBe(DEFAULT_PIECE_SKIN_ID);
    expect(getPieceSkin('unknown')).toMatchObject({ id: DEFAULT_PIECE_SKIN_ID });
  });

  it('keeps skins in render state without making them part of game logic', () => {
    const state = createInitialState({
      playerCount: 2,
      activeSeats: ['Player1', 'Player2'],
      playerColors: ['ruby', 'sapphire'],
      playerSkins: { Player1: 'faceted', Player2: 'unknown' }
    });

    expect(state.players.Player1).toMatchObject({ color: 'ruby', pieceSkinId: 'faceted', pieces: [-1, -1, -1, -1] });
    expect(state.players.Player2.pieceSkinId).toBe(DEFAULT_PIECE_SKIN_ID);
  });

  it('unlocks earned skins only at their required progression level', () => {
    expect(isPieceSkinUnlocked('sunfire', 2)).toBe(false);
    expect(isPieceSkinUnlocked('sunfire', 3)).toBe(true);
    expect(isPieceSkinUnlocked('royal', 4)).toBe(false);
    expect(isPieceSkinUnlocked('royal', 5)).toBe(true);
    expect(getEquippedPieceSkinId('royal', 1)).toBe(DEFAULT_PIECE_SKIN_ID);
  });
});

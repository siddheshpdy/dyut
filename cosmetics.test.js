import { describe, expect, it } from 'vitest';
import { DEFAULT_PIECE_SKIN_ID, PIECE_SKINS, getPieceSkin, isPieceSkinOwned, normalizePieceSkinId } from './pieceSkins.js';
import { createInitialState } from './GameContext.jsx';

describe('piece skins', () => {
  it('exposes stable free catalog entries', () => {
    expect(PIECE_SKINS.filter((skin) => skin.acquisition === 'free').map((skin) => skin.id)).toEqual(['classic']);
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
      playerSkins: { Player1: 'lotus', Player2: 'unknown' }
    });

    expect(state.players.Player1).toMatchObject({ color: 'ruby', pieceSkinId: 'lotus', pieces: [-1, -1, -1, -1] });
    expect(state.players.Player2.pieceSkinId).toBe(DEFAULT_PIECE_SKIN_ID);
  });

  it('requires ownership before a coin-purchased skin can be equipped', () => {
    expect(isPieceSkinOwned('classic', [])).toBe(true);
    expect(isPieceSkinOwned('lotus', ['classic'])).toBe(false);
    expect(isPieceSkinOwned('lotus', ['classic', 'lotus'])).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIECE_SKIN_ID,
  PIECE_SKINS,
  getPieceSkin,
  normalizePieceSkinId,
} from './pieceSkins';

describe('piece skins', () => {
  it('keeps cosmetic designs independent from seat colors', () => {
    const sameSkinForEverySeat = ['ruby', 'sapphire', 'emerald', 'amber']
      .map((seatColor) => ({ seatColor, pieceSkinId: 'lotus' }));

    expect(new Set(sameSkinForEverySeat.map((player) => player.pieceSkinId))).toEqual(new Set(['lotus']));
    expect(new Set(sameSkinForEverySeat.map((player) => player.seatColor)).size).toBe(4);
  });

  it('provides stable unique catalog IDs and a safe fallback', () => {
    expect(new Set(PIECE_SKINS.map((skin) => skin.id)).size).toBe(PIECE_SKINS.length);
    expect(normalizePieceSkinId('not-a-skin')).toBe(DEFAULT_PIECE_SKIN_ID);
    expect(getPieceSkin('lotus').symbol).toBe('✤');
  });
});

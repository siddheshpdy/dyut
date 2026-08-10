export const DEFAULT_PIECE_SKIN_ID = 'classic';

export const FREE_PIECE_SKINS = Object.freeze([
  { id: 'classic', label: 'Classic', className: 'piece-skin-classic', acquisition: 'free' },
  { id: 'faceted', label: 'Faceted', className: 'piece-skin-faceted', acquisition: 'free' }
]);

export const PURCHASED_PIECE_SKINS = Object.freeze([
  { id: 'halo', label: 'Halo', className: 'piece-skin-halo', acquisition: 'coins', price: 150 },
  { id: 'etched', label: 'Etched', className: 'piece-skin-etched', acquisition: 'coins', price: 300 }
]);

export const EARNED_PIECE_SKINS = Object.freeze([
  { id: 'sunfire', label: 'Sunfire', className: 'piece-skin-sunfire', acquisition: 'level', unlockLevel: 3 },
  { id: 'royal', label: 'Royal', className: 'piece-skin-royal', acquisition: 'level', unlockLevel: 5 }
]);

export const PIECE_SKINS = Object.freeze([...FREE_PIECE_SKINS, ...PURCHASED_PIECE_SKINS, ...EARNED_PIECE_SKINS]);

export function normalizePieceSkinId(pieceSkinId) {
  return PIECE_SKINS.some((skin) => skin.id === pieceSkinId)
    ? pieceSkinId
    : DEFAULT_PIECE_SKIN_ID;
}

export function getPieceSkin(pieceSkinId) {
  const normalizedId = normalizePieceSkinId(pieceSkinId);
  return PIECE_SKINS.find((skin) => skin.id === normalizedId);
}

export function getDefaultOwnedPieceSkinIds() {
  return FREE_PIECE_SKINS.map((skin) => skin.id);
}

export function isPieceSkinUnlocked(pieceSkinId, level = 1, ownedPieceSkinIds = getDefaultOwnedPieceSkinIds()) {
  const skin = getPieceSkin(pieceSkinId);
  if (skin.acquisition === 'free') return true;
  if (skin.acquisition === 'level') return Number(level) >= skin.unlockLevel;
  return Array.isArray(ownedPieceSkinIds) && ownedPieceSkinIds.includes(skin.id);
}

export function getEquippedPieceSkinId(pieceSkinId, level = 1, ownedPieceSkinIds) {
  const normalizedId = normalizePieceSkinId(pieceSkinId);
  return isPieceSkinUnlocked(normalizedId, level, ownedPieceSkinIds) ? normalizedId : DEFAULT_PIECE_SKIN_ID;
}

export const DEFAULT_PIECE_SKIN_ID = 'classic';

export const PIECE_SKINS = Object.freeze([
  {
    id: 'classic',
    nameKey: 'pieceSkinClassic',
    fallbackName: 'Classic',
    symbol: '●',
  },
  {
    id: 'lotus',
    nameKey: 'pieceSkinLotus',
    fallbackName: 'Lotus',
    symbol: '✤',
  },
  {
    id: 'chakra',
    nameKey: 'pieceSkinChakra',
    fallbackName: 'Chakra',
    symbol: '✺',
  },
  {
    id: 'royal',
    nameKey: 'pieceSkinRoyal',
    fallbackName: 'Royal',
    symbol: '◆',
  },
]);

const PIECE_SKIN_BY_ID = Object.fromEntries(PIECE_SKINS.map((skin) => [skin.id, skin]));

export const getPieceSkin = (skinId) => (
  PIECE_SKIN_BY_ID[skinId] || PIECE_SKIN_BY_ID[DEFAULT_PIECE_SKIN_ID]
);

export const normalizePieceSkinId = (skinId) => getPieceSkin(skinId).id;

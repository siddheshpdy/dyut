export const DEFAULT_PIECE_SKIN_ID = 'classic';

export const PIECE_SKINS = Object.freeze([
  {
    id: 'classic',
    nameKey: 'pieceSkinClassic',
    fallbackName: 'Classic',
    acquisition: 'free',
    symbol: '●',
  },
  {
    id: 'lotus',
    nameKey: 'pieceSkinLotus',
    fallbackName: 'Lotus',
    acquisition: 'coins',
    price: 750,
    symbol: '✤',
  },
  {
    id: 'chakra',
    nameKey: 'pieceSkinChakra',
    fallbackName: 'Chakra',
    acquisition: 'coins',
    price: 1200,
    symbol: '✺',
  },
  {
    id: 'royal',
    nameKey: 'pieceSkinRoyal',
    fallbackName: 'Royal',
    acquisition: 'coins',
    price: 2000,
    symbol: '◆',
  },
  {
    id: 'conch',
    nameKey: 'pieceSkinConch',
    fallbackName: 'Conch',
    acquisition: 'coins',
    price: 3000,
    symbol: '✧',
  },
  {
    id: 'peacock',
    nameKey: 'pieceSkinPeacock',
    fallbackName: 'Peacock',
    acquisition: 'coins',
    price: 4500,
    symbol: '✺',
  },
  {
    id: 'eclipse',
    nameKey: 'pieceSkinEclipse',
    fallbackName: 'Eclipse',
    acquisition: 'coins',
    price: 6500,
    symbol: '◐',
  },
  {
    id: 'temple',
    nameKey: 'pieceSkinTemple',
    fallbackName: 'Temple',
    acquisition: 'coins',
    price: 9000,
    symbol: '♜',
  },
  {
    id: 'celestial',
    nameKey: 'pieceSkinCelestial',
    fallbackName: 'Celestial',
    acquisition: 'coins',
    price: 12000,
    symbol: '✹',
  },
]);

const PIECE_SKIN_BY_ID = Object.fromEntries(PIECE_SKINS.map((skin) => [skin.id, skin]));

export const getPieceSkin = (skinId) => (
  PIECE_SKIN_BY_ID[skinId] || PIECE_SKIN_BY_ID[DEFAULT_PIECE_SKIN_ID]
);

export const normalizePieceSkinId = (skinId) => getPieceSkin(skinId).id;

export const getDefaultOwnedPieceSkinIds = () => [DEFAULT_PIECE_SKIN_ID];

export const normalizeOwnedPieceSkinIds = (skinIds) => [
  ...new Set([
    ...getDefaultOwnedPieceSkinIds(),
    ...(Array.isArray(skinIds) ? skinIds.filter((skinId) => PIECE_SKIN_BY_ID[skinId]) : []),
  ]),
];

export const isPieceSkinOwned = (skinId, ownedSkinIds) => {
  const skin = getPieceSkin(skinId);
  return skin.acquisition === 'free' || normalizeOwnedPieceSkinIds(ownedSkinIds).includes(skin.id);
};

import { HttpsError } from 'firebase-functions/v2/https';
import { requireObject } from '../errors.js';

export const SEAT_IDS = ['Player1', 'Player2', 'Player3', 'Player4'];
const COLORS = new Set(['ruby', 'sapphire', 'emerald', 'amber', 'yellow', 'black', 'green', 'blue']);

function safeName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}

// Seat ownership is never accepted from a browser payload. The caller may
// edit presentation/configuration fields, while UID ownership changes only
// through createLobby or claimLobbySeat.
export function sanitizeSeat(seat = {}, fallback = {}) {
  const ownedByExistingPlayer = typeof fallback.uid === 'string' && fallback.uid.length <= 128;
  const type = ownedByExistingPlayer
    ? 'human'
    : (['human', 'bot', 'closed'].includes(seat.type) ? seat.type : fallback.type || 'closed');
  return {
    type,
    color: COLORS.has(seat.color) ? seat.color : fallback.color || 'ruby',
    name: safeName(seat.name ?? fallback.name),
    pieceSkinId: typeof seat.pieceSkinId === 'string' ? seat.pieceSkinId.slice(0, 32) : fallback.pieceSkinId || 'classic',
    uid: type === 'human' && typeof fallback.uid === 'string' && fallback.uid.length <= 128 ? fallback.uid : null,
  };
}

export function sanitizeSeats(value, existing = {}) {
  requireObject(value, 'seats');
  return Object.fromEntries(SEAT_IDS.map((id) => [id, sanitizeSeat(value[id], existing[id])])) ;
}

export function openSeatCount(seats) {
  return Object.values(seats).filter((seat) => seat.type === 'human' && !seat.uid).length;
}

export function validateSeatId(playerId) {
  if (typeof playerId !== 'string' || !SEAT_IDS.includes(playerId)) {
    throw new HttpsError('invalid-argument', 'Invalid player seat.');
  }
  return playerId;
}

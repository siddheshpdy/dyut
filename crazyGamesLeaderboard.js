const IS_PORTAL = import.meta.env.VITE_CRAZYGAMES_BUILD === 'true';
const ENCRYPTION_KEY = import.meta.env.VITE_CRAZYGAMES_LEADERBOARD_ENCRYPTION_KEY;

export const isCrazyGamesLeaderboardConfigured = Boolean(ENCRYPTION_KEY);

export async function encryptCrazyGamesScore(score, encryptionKey = ENCRYPTION_KEY) {
  if (!encryptionKey || typeof window === 'undefined' || !window.crypto?.subtle) return null;

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = Uint8Array.from(atob(encryptionKey), (character) => character.charCodeAt(0));
  const algorithm = { name: 'AES-GCM', iv };
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt']);
  const dataBuffer = new TextEncoder().encode(String(score));
  const encryptedBuffer = await window.crypto.subtle.encrypt(algorithm, cryptoKey, dataBuffer);
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function submitCrazyGamesWinScore(wins) {
  const score = Math.max(0, Number(wins) || 0);
  const submitScore = window.CrazyGames?.SDK?.user?.submitScore;
  if (!IS_PORTAL || !submitScore || !ENCRYPTION_KEY) return { submitted: false };

  if (window.cgInitPromise) await window.cgInitPromise;
  const encryptedScore = await encryptCrazyGamesScore(score);
  if (!encryptedScore) return { submitted: false };

  await submitScore({ encryptedScore, score });
  return { submitted: true, score };
}

import { ref, query, orderByChild, equalTo, limitToFirst, get } from 'firebase/database';
import { rtdb } from './firebaseSetup.js';

/**
 * Searches Firebase Realtime Database for an open, public lobby.
 * @param {object} config - The lobby rules configuration.
 * @returns {Promise<string|null>} The lobby ID if found, or null if no lobbies are available.
 */
export async function findRandomPublicGame(config = {}) {
  try {
    // RTDB only allows sorting/filtering on a single child key.
    // We query by 'status' == 'waiting' and filter the rest locally.
    const lobbiesRef = ref(rtdb, 'lobbies');
    const q = query(
      lobbiesRef,
      orderByChild('status'),
      equalTo('waiting'),
      limitToFirst(50) 
    );

    const snapshot = await get(q);
    if (!snapshot.exists()) return null;

    const lobbies = snapshot.val();
    // Randomize the order so players don't all pile into the absolute oldest lobby simultaneously
    const lobbyEntries = Object.entries(lobbies).sort(() => Math.random() - 0.5);

    for (const [id, data] of lobbyEntries) {
      
      if (
        data.isPublic === true &&
        data.version === 2 &&
        data.openSeats > 0 &&
        data.matchType === (config.matchType || 'ffa') &&
        !!data.isQuickGame === !!config.isQuickGame &&
        !!data.isTeamMode === !!config.isTeamMode &&
        !!data.isVoidRuleEnabled === !!config.isVoidRuleEnabled
      ) {
        return id;
      }
    }

    // No public lobbies with the exact requested config are available right now
    return null;
  } catch (error) {
    console.error("Error finding random game:", error);
    return null;
  }
}
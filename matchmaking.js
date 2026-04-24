import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebaseSetup.js';

/**
 * Searches Firestore for an open, public lobby.
 * @param {object} config - The lobby rules configuration.
 * @returns {Promise<string|null>} The lobby ID if found, or null if no lobbies are available.
 */
export async function findRandomPublicGame(config = {}) {
  try {
    const lobbiesRef = collection(db, 'lobbies');
    
    // Query for a lobby that is explicitly public and currently waiting
    const q = query(
      lobbiesRef,
      where('isPublic', '==', true),
      where('status', '==', 'waiting'),
      where('matchType', '==', config.matchType || 'ffa'),
      where('isQuickGame', '==', !!config.isQuickGame),
      where('isTeamMode', '==', !!config.isTeamMode),
      where('isVoidRuleEnabled', '==', !!config.isVoidRuleEnabled),
      limit(1) // We only need to find one available game
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Found an open lobby! Return its document ID
      return querySnapshot.docs[0].id;
    }

    // No public lobbies available right now
    return null;
  } catch (error) {
    console.error("Error finding random game:", error);
    return null;
  }
}
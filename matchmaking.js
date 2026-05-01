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
    // We fetch a small batch and filter the fine-grained settings (quick game, void rule) 
    // locally to prevent Firestore from demanding extremely complex composite indexes.
    const q = query(
      lobbiesRef,
      where('isPublic', '==', true),
      where('status', '==', 'waiting'),
      where('version', '==', 2),
      where('openSeats', '>', 0),
      limit(20) 
    );

    const querySnapshot = await getDocs(q);

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      // Perform exact configuration matching locally
      if (
        data.matchType === (config.matchType || 'ffa') &&
        !!data.isQuickGame === !!config.isQuickGame &&
        !!data.isTeamMode === !!config.isTeamMode &&
        !!data.isVoidRuleEnabled === !!config.isVoidRuleEnabled
      ) {
        return docSnap.id;
      }
    }

    // No public lobbies with the exact requested config are available right now
    return null;
  } catch (error) {
    console.error("Error finding random game:", error);
    return null;
  }
}
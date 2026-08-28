import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FUNCTION_REGION } from './config.js';
import { rejectIfAppCheckMissing, requireAuth, requireObject } from './errors.js';

if (getApps().length === 0) initializeApp();
const db = getFirestore();

export const updateProfileName = onCall({
  region: FUNCTION_REGION,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
}, async (request) => {
  try {
    rejectIfAppCheckMissing(request);
    const uid = requireAuth(request);
    requireObject(request.data, 'data');
    const displayName = typeof request.data.displayName === 'string' ? request.data.displayName.trim() : '';
    if (!displayName || displayName.length > 40) throw new HttpsError('invalid-argument', 'Display name must be 1 to 40 characters.');
    const userRef = db.collection('users').doc(uid);
    const leaderboardRef = db.collection('leaderboardEntries').doc(uid);
    await db.runTransaction(async (transaction) => {
      // A profile edit must not create a ranking row. Only propagate the name
      // when a server-verified completion has already materialized the row.
      const leaderboardSnapshot = await transaction.get(leaderboardRef);
      transaction.set(userRef, { displayName, lastLogin: new Date() }, { merge: true });
      if (leaderboardSnapshot.exists) {
        transaction.set(leaderboardRef, { displayName, updatedAt: new Date() }, { merge: true });
      }
    });
    return { displayName };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Failed to update profile name:', error);
    throw new HttpsError('internal', 'Profile name could not be updated.');
  }
});

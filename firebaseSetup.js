import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, linkWithPopup, signOut, signInWithCredential, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// TODO: Replace this with your actual Firebase project configuration from the console
// 1. Go to console.firebase.google.com
// 2. Create a project and add a "Web App"
// 3. Copy the config object below

if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.error("Firebase API Key is missing! Ensure your GitHub Secrets are correctly mapped in your GitHub Actions workflow files.");
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export initialized services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const signInUserAnonymously = async () => {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Error signing in anonymously: ", error);
  }
};

export const initializeUserProfile = async (user) => {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  // When linking an anonymous account to Google, the top-level user object
  // often doesn't inherit the provider's displayName automatically.
  let bestName = user.displayName;
  let bestPhoto = user.photoURL;
  
  if (user.providerData && user.providerData.length > 0) {
    const provider = user.providerData[0];
    bestName = bestName || provider.displayName;
    bestPhoto = bestPhoto || provider.photoURL;
  }

  // Sync the provider profile to Firebase Auth if it's missing
  if (!user.displayName && bestName) {
    try {
      await updateProfile(user, { displayName: bestName, photoURL: bestPhoto });
      await user.getIdToken(true); // Force token refresh so App.jsx catches the new name
    } catch (e) {
      console.error("Failed to sync provider profile to auth:", e);
    }
  }

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: bestName || 'Anonymous Player',
      photoURL: bestPhoto || null,
      gamesPlayed: 0,
      wins: 0,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
  } else {
        const currentData = userSnap.data();
        await updateDoc(userRef, { 
          lastLogin: serverTimestamp(),
      ...(bestPhoto && !currentData.photoURL && { photoURL: bestPhoto }),
      ...(bestName && (!currentData.displayName || currentData.displayName === 'Anonymous Player') && { displayName: bestName })
        });
  }
};

export const updateUserStats = async (uid, isWin) => {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      gamesPlayed: increment(1),
      ...(isWin && { wins: increment(1) })
    });
  } catch (error) {
    console.error("Failed to update user stats:", error);
  }
};

export const updateUserName = async (newName) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateProfile(user, { displayName: newName });
    await user.getIdToken(true); // Force token refresh to sync App.jsx state
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { displayName: newName });
  } catch (error) {
    console.error("Failed to update user name:", error);
  }
};

export const updateUserAvatar = async (file) => {
  const user = auth.currentUser;
  if (!user || !file) return;
  try {
    const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    const photoURL = await getDownloadURL(storageRef);
    await updateProfile(user, { photoURL });
    await user.getIdToken(true); // Force token refresh to sync App.jsx state
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { photoURL });
  } catch (error) {
    console.error("Failed to update user avatar:", error);
  }
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        const result = await linkWithPopup(auth.currentUser, provider);
        await initializeUserProfile(result.user);
      } catch (error) {
        if (error.code === 'auth/credential-already-in-use') {
          // The Google account is already tied to a persistent user. Sign in normally using the credential to avoid a second popup block.
          const credential = GoogleAuthProvider.credentialFromError(error);
          if (credential) {
            const result = await signInWithCredential(auth, credential);
            await initializeUserProfile(result.user);
          }
        } else {
          throw error;
        }
      }
    } else {
      const result = await signInWithPopup(auth, provider);
      await initializeUserProfile(result.user);
    }
  } catch (error) {
    console.error("Error with Google Sign-In: ", error);
    if (error.code === 'auth/operation-not-allowed') {
      alert("Google Sign-In is not enabled. Please enable it in the Firebase Console -> Authentication -> Sign-in method.");
    } else if (error.code !== 'auth/popup-closed-by-user') {
      alert("Failed to sign in with Google: " + error.message);
    }
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    await signInAnonymously(auth); // Fallback to a new anonymous session instantly
  } catch (error) {
    console.error("Error signing out: ", error);
  }
};
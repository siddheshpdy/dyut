import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const signInUserAnonymously = async () => {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Error signing in anonymously: ", error);
  }
};
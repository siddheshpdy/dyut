import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace this with your actual Firebase project configuration from the console
// 1. Go to console.firebase.google.com
// 2. Create a project and add a "Web App"
// 3. Copy the config object below
const firebaseConfig = {
  apiKey: "AIzaSyB4fkOpevKsyFrNC5nJ6W9-G1RDW8-b_Tg",
  authDomain: "onlinedyut.firebaseapp.com",
  projectId: "onlinedyut",
  storageBucket: "onlinedyut.firebasestorage.app",
  messagingSenderId: "344138675990",
  appId: "1:344138675990:web:2df32c7baad40ac4584237",
  measurementId: "G-X4Y0M1M89C"
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
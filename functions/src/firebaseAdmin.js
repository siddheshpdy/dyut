import { getApps, initializeApp } from 'firebase-admin/app';

// Realtime Database does not infer its URL from GCLOUD_PROJECT in every
// deployment-analysis and local-runtime context. Keep the URL environment-
// specific and never hard-code a project credential in source control.
const databaseUrl = process.env.DATABASE_URL || '';
const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '';
const emulatorDatabaseUrl = emulatorHost && projectId
  ? `http://${emulatorHost}?ns=${projectId}`
  : '';
// Firebase's Functions emulator exposes FIREBASE_DATABASE_EMULATOR_HOST. It
// must take precedence over the ignored production DATABASE_URL so local
// integration tests cannot accidentally write to the live RTDB instance.
const inferredDatabaseUrl = emulatorDatabaseUrl || databaseUrl || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '');
const appOptions = inferredDatabaseUrl
  ? { databaseURL: inferredDatabaseUrl, ...(projectId ? { projectId } : {}) }
  : {};

export const adminApp = getApps().length > 0
  ? getApps()[0]
  : initializeApp(appOptions);

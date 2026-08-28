import { setGlobalOptions } from 'firebase-functions/v2';

// Keep server defaults explicit so a deployment is predictable and can be
// tuned centrally without changing individual handlers.
// FUNCTION_REGION is reserved by Firebase and cannot be defined in a dotenv
// file. Use a project-owned key for local/deployment configuration while
// keeping asia-south1 as the safe default.
export const FUNCTION_REGION = process.env.DYUT_FUNCTION_REGION || 'asia-south1';
// Realtime Database triggers must be deployed in the database instance's
// region. Keep this separate from callable function placement.
export const DATABASE_REGION = process.env.DATABASE_REGION || 'us-central1';

setGlobalOptions({
  region: FUNCTION_REGION,
  maxInstances: Number(process.env.FUNCTION_MAX_INSTANCES || 20),
  concurrency: Number(process.env.FUNCTION_CONCURRENCY || 40),
  memory: '256MiB',
  timeoutSeconds: 30,
});

import { HttpsError } from 'firebase-functions/v2/https';

export const requireAuth = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  return request.auth.uid;
};

export const requireObject = (value, message = 'A valid request is required.') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', message);
  }
  return value;
};

export const rejectIfAppCheckMissing = (request) => {
  if (process.env.ENFORCE_APP_CHECK === 'true' && !request.app) {
    throw new HttpsError('failed-precondition', 'App verification is required.');
  }
};

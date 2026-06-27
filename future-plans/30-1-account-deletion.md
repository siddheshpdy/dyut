# Phase 30.1: Account Deletion Plan

## Objective

Allow users to delete their account and associated personal data to satisfy app store and privacy requirements.

## Why This Matters

Google Play, Apple App Store, and privacy regulations require a clear account deletion path when account creation or sign-in exists.

## Current Touchpoints

- `UnifiedLobby.jsx`: `PlayerProfile` component
- `firebaseSetup.js`: auth helpers and user profile writes
- Firestore `users` collection
- Firebase Auth
- Future Cloud Functions

## Data to Delete

Primary:

- Firebase Auth user
- Firestore `users/{uid}`

Related:

- referrals where user is referrer/referee
- match history containing uid
- private inventory/purchase metadata where legally allowed
- lobby/game seat ownership for active games

Retain only if required:

- anonymized aggregate stats
- payment records required for tax/fraud compliance

## Implementation Steps

1. Add Delete Account entry to profile UI.
   Why: deletion must be discoverable in-app.

2. Add confirmation dialog requiring exact `DELETE`.
   Why: account deletion is destructive and should be deliberate.

3. Re-authenticate Google users when required.
   Why: Firebase may reject deletion if login is stale.

4. Call a Cloud Function to prepare deletion.
   Why: related Firestore/RTDB cleanup cannot be trusted to the client.

5. Delete Firebase Auth user.
   Why: auth deletion is the core account removal action.

6. Add `onAuth.user().onDelete` cleanup function.
   Why: backend cleanup should run even if client flow partially fails.

7. Redirect to anonymous/local state after deletion.
   Why: the app should remain usable without a signed-in profile.

## Security Notes

- Only the authenticated user can request their own deletion.
- Cleanup functions must be idempotent.
- Active public match behavior should replace deleted user with bot or mark them left.

## Tests

- Emulator test user document cleanup on auth deletion.
- Manual Google account deletion with recent and stale login.
- Manual deletion during active lobby.
- Regression test anonymous fallback after deletion.

## Rollout Plan

1. Add UI and Firebase Auth deletion.
2. Add Firestore user cleanup.
3. Add related data cleanup.
4. Add public documentation in Privacy Policy.

## Dependencies

- Phase 30.2 legal pages should reference deletion instructions.

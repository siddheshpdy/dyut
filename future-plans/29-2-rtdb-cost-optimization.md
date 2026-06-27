# Phase 29.2: Active Game RTDB Cost Optimization Plan

## Objective

Keep high-frequency active game state in Firebase Realtime Database and reserve Firestore for persistent user/account data.

## Why This Matters

Active board games generate frequent state updates. RTDB is a better fit for ephemeral synchronized state, while Firestore remains appropriate for profiles, purchases, history, and leaderboards.

## Current Status

This phase is partially implemented already:

- `GameContext.jsx` uses RTDB `ref`, `onValue`, `set`, `update`, and `remove` for active games.
- `UnifiedLobby.jsx` uses RTDB for lobbies.
- Firestore is still used for user profiles and stats.

## Target Architecture

RTDB:

- `lobbies/{gameId}`
- `games/{gameId}`
- `presence/{gameId}/{uid}`

Firestore:

- `users/{uid}`
- `storeProducts/{productId}`
- `leaderboards/*`
- `matchHistory/{matchId}`
- `referrals/{referralId}`

## Implementation Steps

1. Audit all active-game Firestore references.
   Why: old imports or comments can hide leftover cost-heavy paths.

2. Add explicit data lifecycle cleanup.
   Why: RTDB game and lobby nodes should be removed after completion or abandonment.

3. Add presence tracking.
   Why: presence should be cheap and separate from full game state writes.

4. Batch online game updates where possible.
   Why: fewer RTDB writes reduce cost and race conditions.

5. Split lobby state from game state consistently.
   Why: matchmaking should not subscribe to full game state.

6. Add monitoring and logging.
   Why: cost optimization needs observable read/write volume.

7. Update docs and security rules.
   Why: schema clarity prevents future regressions back to Firestore active games.

## Security Notes

- RTDB rules must validate auth membership for lobbies and games.
- Public lobby discovery should expose only safe fields.
- Finished games should be immutable or removed.

## Tests

- Manual two-client lobby and gameplay sync.
- Emulator tests for RTDB security rules if rules are added to repo.
- Integration test cleanup after finish/leave.
- Cost smoke test with repeated bot turns.

## Rollout Plan

1. Document current RTDB schema.
2. Add presence and cleanup hardening.
3. Add monitoring.
4. Remove stale Firestore active-game references.

## Dependencies

- Complements server-side authority.
- Needed before scaling public matchmaking.

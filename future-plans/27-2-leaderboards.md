# Phase 27.2: Global & Regional Leaderboards Plan

## Objective

Add global and regional leaderboard views for wins, XP, and possibly weekly performance.

## Why This Matters

Leaderboards create competition and give players a reason to return, especially once XP and public matchmaking are active.

## Current Touchpoints

- Firestore `users` collection
- `UnifiedLobby.jsx`: main navigation entry point
- `firebaseSetup.js`: user profile and stats writes
- Future Cloud Functions project

## Data Model

Firestore generated documents:

- `leaderboards/global_wins`
- `leaderboards/global_xp`
- `leaderboards/weekly_wins`
- `leaderboards/region_{code}_wins`

Document shape:

- `updatedAt`
- `entries: [{ uid, displayName, photoURL, wins, xp, level, regionCode, rank }]`

User profile additions:

- `regionCode: string | null`
- `leaderboardOptOut: boolean`

## Implementation Steps

1. Add leaderboard-safe public profile fields.
   Why: the leaderboard should not expose private account data.

2. Create scheduled Cloud Function to materialize top lists.
   Why: querying and ranking every client is expensive and easy to abuse.

3. Add region assignment strategy.
   Why: regional boards need a stable and privacy-conscious source such as user-selected region or coarse locale.

4. Build `LeaderboardScreen.jsx`.
   Why: leaderboard rendering should not inflate the lobby component.

5. Add navigation entry from lobby/header.
   Why: players need discoverable access outside active matches.

6. Add current-player rank preview if feasible.
   Why: seeing personal progress is more motivating than only seeing top 100 players.

7. Add opt-out handling.
   Why: public rankings should respect privacy expectations.

## Security Notes

- Clients should read only materialized leaderboard docs.
- Scheduled function should exclude banned, deleted, or opted-out users.
- Do not expose emails or raw auth provider details.

## Tests

- Unit test ranking function with ties and missing fields.
- Emulator test scheduled function output.
- Component test empty, loading, and populated leaderboard states.
- Manual test localization and mobile layout.

## Rollout Plan

1. Add global wins leaderboard.
2. Add global XP after progression ships.
3. Add weekly and regional boards.

## Dependencies

- Phase 27.1 progression for XP rankings.
- Phase 30.2 privacy policy should mention public display names/rankings.

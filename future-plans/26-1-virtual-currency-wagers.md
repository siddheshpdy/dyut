# Phase 26.1: Virtual Currency & Wagers Plan

## Objective

Introduce Dyut Coins as a soft currency that supports daily rewards, wagered matches, and future rewards from quests, referrals, ads, and progression.

## Why This Matters

Coins create persistent stakes outside a single match. They also become the shared reward currency for later systems such as daily quests, rewarded ads, referrals, level milestones, and cosmetic unlocks.

## Current Touchpoints

- `firebaseSetup.js`: user profile creation and stat updates
- `UnifiedLobby.jsx`: match setup, public/private lobbies, seat claiming
- `GameContext.jsx`: game-over detection and winner handling
- `VictoryScreen.jsx`: post-match reward feedback
- Firestore `users` collection
- RTDB `lobbies` and `games` nodes

## Data Model

Firestore `users/{uid}` additions:

- `coins: number`
- `lastDailyReward: timestamp | null`
- `economyVersion: number`
- `lifetimeCoinsEarned: number`
- `lifetimeCoinsSpent: number`

RTDB `lobbies/{gameId}` additions:

- `wagerAmount: number`
- `pot: number`
- `paidSeats: { [playerId]: true }`
- `rakePercent: number`

RTDB `games/{gameId}` additions:

- `wagerAmount`
- `pot`
- `rakePercent`
- `payoutProcessed: boolean`

## Implementation Steps

1. Add economy defaults in `initializeUserProfile`.
   Why: existing users need safe defaults without requiring a migration script before the app can read coin balances.

2. Create economy helper functions in a new module such as `economyService.js`.
   Why: coin grants, deductions, and payouts should be centralized so later quests, ads, referrals, and progression do not duplicate balance logic.

3. Add a `DailyReward.jsx` modal or panel that checks `lastDailyReward`.
   Why: daily rewards are the first low-risk coin source and validate the profile schema before wagers spend coins.

4. Add a wager selector to `UnifiedLobby.jsx` for hosts.
   Why: wagers belong to match setup, and all clients already subscribe to lobby state.

5. Deduct wager entry fees when a human seat is claimed or when the host starts the match.
   Why: deductions must happen before gameplay starts so players cannot join a wagered game without enough balance.

6. Store `pot` and wager metadata in the game document when a match starts.
   Why: payout logic must survive lobby cleanup and reconnects.

7. Process payout when the match reaches finished state.
   Why: payout should be tied to authoritative game completion, not just the local victory screen.

8. Add user-facing balance and payout feedback in the lobby/profile/victory UI.
   Why: players need visible confirmation when coins are spent or earned.

## Security Notes

- Client-side coin writes are vulnerable. The first version can use Firestore transactions, but production wagers should move to Cloud Functions.
- Payout must be idempotent using `payoutProcessed`.
- Public matches should either disable wagers initially or use fixed low stakes until abuse controls exist.

## Tests

- Unit test economy helpers for daily reward eligibility and payout math.
- Integration test lobby wager validation for insufficient funds.
- Reducer or service test ensuring payout cannot run twice.
- Manual test with two browser sessions for private wagered match flow.

## Rollout Plan

1. Ship balances and daily rewards with wagers disabled.
2. Enable private wagered matches.
3. Enable public wagered matches only after server-side payout protection exists.

## Dependencies

- Required for daily quests, rewarded ads, referral rewards, and progression milestone rewards.
- Should be planned before cosmetic store because cosmetics need a currency and inventory foundation.

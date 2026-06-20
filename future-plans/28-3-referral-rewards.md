# Phase 28.3: Referral Rewards Plan

## Objective

Reward players for inviting new users who create an account or play their first match.

## Why This Matters

Referral rewards can grow the player base while feeding coins and cosmetics into the retention loop.

## Current Touchpoints

- `App.jsx`: URL parsing
- `firebaseSetup.js`: anonymous and Google auth
- `UnifiedLobby.jsx`: profile/invite surfaces
- Future economy service

## Data Model

Firestore `users/{uid}` additions:

- `referralCode: string`
- `referredBy: uid | null`
- `referralRewardClaimed: boolean`
- `referralCount: number`

Firestore `referrals/{referralId}`:

- `referrerUid`
- `refereeUid`
- `createdAt`
- `status: "pending" | "qualified" | "rewarded"`
- `rewardCoins`

## Implementation Steps

1. Generate stable referral codes for signed-in users.
   Why: referral links should not expose raw UIDs if avoidable.

2. Parse `?ref=CODE` in `App.jsx`.
   Why: attribution must be captured before account/profile creation completes.

3. Store pending referral attribution locally for anonymous users.
   Why: players may arrive before they sign in or finish onboarding.

4. Attach `referredBy` during first profile creation only.
   Why: referrals should not be changed later for abuse.

5. Add qualification rule.
   Why: rewards should require meaningful activity such as first completed match.

6. Add Cloud Function reward fulfillment.
   Why: clients should not grant referral coins directly.

7. Add referral UI in profile/lobby.
   Why: users need their share link and reward count.

## Security Notes

- Prevent self-referrals.
- Prevent multiple rewards for the same referee.
- Require account age or first completed match before payout.
- Use server-side validation for rewards.

## Tests

- Unit test referral code parsing and validation.
- Emulator test Cloud Function reward flow.
- Manual test anonymous landing then Google sign-in.
- Manual test self-referral rejection.

## Rollout Plan

1. Add referral links and attribution only.
2. Add reward after first completed match.
3. Add referral count and history UI.

## Dependencies

- Phase 26.1 coins.
- Phase 30.2 privacy policy should mention referral attribution.

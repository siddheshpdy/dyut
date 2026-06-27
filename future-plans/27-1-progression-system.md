# Phase 27.1: Progression System Plan

## Objective

Add XP, levels, and milestone rewards so players have long-term goals beyond individual wins.

## Why This Matters

Progression improves retention and gives cosmetics, quests, and match history more meaning. It also creates a low-stakes reward loop that does not affect gameplay balance.

## Current Touchpoints

- `firebaseSetup.js`: user stats updates
- `GameContext.jsx`: game-over detection
- `VictoryScreen.jsx`: post-match feedback
- `UnifiedLobby.jsx`: profile summary
- Future cosmetics inventory

## Data Model

Firestore `users/{uid}` additions:

- `xp: number`
- `level: number`
- `levelRewardsClaimed: number[]`
- `matchStats: { captures, piecesFinished, turnsTaken, durationMs }` if stored

## XP Rules

Initial suggested formula:

- Match completed: 25 XP
- Win: 75 XP
- Capture: 10 XP each
- Piece finished: 15 XP each
- Quick game modifier: `0.6`
- Bot-only local match modifier: `0.5`

Level curve:

- `xpForLevel(level) = 100 + (level - 1) * 50`

## Implementation Steps

1. Create `progressionService.js` with XP calculation and level helpers.
   Why: XP math should be testable and independent from UI.

2. Add profile defaults for `xp`, `level`, and `levelRewardsClaimed`.
   Why: old accounts need predictable values.

3. Track match stats during gameplay.
   Why: XP should reflect actual match events, not just win/loss.

4. Update `updateUserStats` or create `completeMatchForUser`.
   Why: stats and XP should be committed together to avoid partial progress.

5. Add XP summary to `VictoryScreen.jsx`.
   Why: the end of a match is the natural reward moment.

6. Add compact level display to `PlayerProfile`.
   Why: players need persistent status visibility.

7. Add milestone rewards after cosmetics exist.
   Why: rewards should grant real inventory items or coins.

## Security Notes

- XP should eventually be awarded server-side for online games.
- Local/bot games can grant reduced XP to discourage farming.
- Payout and XP award should be idempotent per match.

## Tests

- Unit tests for XP formula and level-up rollover.
- Unit tests for milestone reward eligibility.
- Component tests for victory XP display.
- Manual test anonymous-to-Google account merge preserves XP.

## Rollout Plan

1. Ship XP and level display.
2. Add victory XP animation.
3. Add milestone rewards once cosmetics are available.

## Dependencies

- Strongly benefits from cosmetics.
- Should integrate with daily quests and leaderboards.

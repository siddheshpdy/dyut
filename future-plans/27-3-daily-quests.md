# Phase 27.3: Daily Quests Plan

## Objective

Add daily quests that reward coins or cosmetics for completing small gameplay goals.

## Why This Matters

Quests turn ordinary matches into directed goals and help retention without changing Dyut's rules.

## Current Touchpoints

- `GameContext.jsx`: match events and game completion
- `firebaseSetup.js`: profile writes
- `UnifiedLobby.jsx`: profile/menu area
- Future coins and cosmetics systems

## Data Model

Firestore `users/{uid}` additions:

- `lastQuestReset: timestamp | null`
- `activeQuests: { [questId]: { progress, target, reward, status } }`
- `completedQuestHistory: string[]`

Quest definition:

- `id`
- `type: "capture" | "finish_piece" | "play_match" | "win_match" | "spawn_piece"`
- `target`
- `rewardCoins`
- `rewardItemId`
- `difficulty`
- `enabled`

## Implementation Steps

1. Define quest catalog in shared config or backend.
   Why: quest definitions need stable IDs for progress and localization.

2. Create `questService.js` for assignment, progress updates, and claims.
   Why: quest logic should stay separate from reducer movement rules.

3. Add daily assignment on login/profile load.
   Why: quest availability belongs to account state, not match state.

4. Track match event summaries.
   Why: quests should update from aggregate match stats instead of injecting logic into every movement branch.

5. Add a Quests panel in the lobby.
   Why: quests are pre-match goals and rewards, not board actions.

6. Add claim flow that grants coins or inventory.
   Why: players should choose when to claim and see a clear reward moment.

7. Add localization strings for quest titles/descriptions.
   Why: quests are user-facing and must match the app's language support.

## Security Notes

- Online quest progress should be validated server-side when server authority exists.
- Claim rewards should be idempotent.
- Local bot matches may grant reduced or limited quest progress.

## Tests

- Unit test quest assignment and 24-hour reset.
- Unit test progress merging and claim idempotency.
- Component test quest panel states.
- Manual test quest reset across time zones.

## Rollout Plan

1. Add play/win match quests.
2. Add capture and finish-piece quests.
3. Add cosmetic reward quests after store/inventory exists.

## Dependencies

- Phase 26.1 coins.
- Phase 27.1 match stats and progression helpers.

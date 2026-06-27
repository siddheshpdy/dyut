# Phase 29.1: Server-Side Authority Plan

## Objective

Move online dice rolls and move validation to server-side authority to prevent cheating.

## Why This Matters

The current online model syncs client-calculated state. That is acceptable for early testing, but wagered matches, leaderboards, progression, and public matchmaking need trusted validation.

## Current Touchpoints

- `GameContext.jsx`: reducer, dispatch interceptor, online sync
- `gameLogic.js`: validation helpers
- `boardMapping.js`: path helpers
- `DiceTray.jsx`: dice roll UI
- `Board.jsx`: move UI and action dispatch
- RTDB `games` nodes

## Backend Shape

Firebase Cloud Functions:

- `createGame`
- `rollDice`
- `executeMove`
- `sendEmote`
- `completeMatch`

Shared rules package:

- pure game logic
- board mapping
- action validation
- state transition helpers

## Implementation Steps

1. Extract pure rule logic into a shared folder.
   Why: server and client must use identical movement, pathing, and combat rules.

2. Separate reducer state transitions from React-specific effects.
   Why: Cloud Functions cannot depend on React hooks, browser APIs, or UI state.

3. Add server callable `rollDice`.
   Why: dice are the easiest cheating target and should be generated server-side.

4. Add server callable `executeMove`.
   Why: clients should submit intent, while the server validates and writes state.

5. Keep client-side prediction optional and visual-only.
   Why: the UI can stay responsive while final state comes from the server.

6. Add auth and turn ownership checks.
   Why: only the current authorized player should act.

7. Add idempotency/action IDs.
   Why: retries should not duplicate moves, payouts, or queue consumption.

8. Update online dispatch path in `GameContext.jsx`.
   Why: online mode should call functions; local mode can keep the reducer path.

## Security Notes

- Never accept dice values from clients in online mode.
- Validate every move against server state.
- Use transactions for game state updates.
- Add rate limits for roll/move calls.

## Tests

- Shared game logic unit tests reused by client and functions.
- Emulator tests for invalid turn, invalid move, duplicate action, and dice roll.
- Manual two-client public match test.
- Regression tests for pair shield, dual spawn, and blood debt online.

## Rollout Plan

1. Extract shared rule module without behavior changes.
2. Server-authorize dice rolls.
3. Server-authorize movement.
4. Move payouts, XP, quests, and wagers behind server completion.

## Dependencies

- Important before wagered public matches, leaderboards, and serious progression rewards.

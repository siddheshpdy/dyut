# Phase 28.1: Expressive Quick Chat & Emotes Plan

## Objective

Add safe, limited player expression through predefined emotes or quick chat messages.

## Why This Matters

Multiplayer games feel more alive when players can react, but free-text chat introduces moderation and platform compliance burdens. Predefined emotes give expression with low risk.

## Current Touchpoints

- `GameContext.jsx`: shared online game state
- `Board.jsx`: player base/avatar rendering
- `UnifiedLobby.jsx`: online lobby and seat identity
- CrazyGames QA chat requirements

## Data Model

RTDB `games/{gameId}` addition:

- `activeEmote: { playerId, emoteId, timestamp } | null`

Optional profile field:

- `equippedEmotes: string[]`

Emote catalog:

- `id`
- `label`
- `icon`
- `animationClass`
- `enabled`

## Implementation Steps

1. Define a small emote catalog.
   Why: a fixed catalog avoids moderation and localization problems.

2. Add `SEND_EMOTE` and `CLEAR_EMOTE` actions to `GameContext`.
   Why: emotes need to sync online but should remain separate from gameplay actions.

3. Add a tiny emote button near each active player display.
   Why: the action should be near player identity, not movement controls.

4. Render floating emote animation over the relevant player base.
   Why: the recipient should understand who sent the reaction.

5. Auto-clear emotes after a short timeout.
   Why: RTDB state should not accumulate stale UI-only values.

6. Respect portal chat settings.
   Why: if a platform disables communication features, emotes should be hidden or disabled.

## Security Notes

- Never allow arbitrary text.
- Rate-limit emotes client-side and eventually server-side.
- Disable emotes in public matchmaking if platform review requires it.

## Tests

- Reducer tests for send/clear emote.
- Component tests for picker rendering.
- Manual two-client test for RTDB sync.
- Manual portal test with communication disabled.

## Rollout Plan

1. Ship local-only emotes.
2. Enable private online emotes.
3. Enable public online emotes after rate limiting and portal checks.

## Dependencies

- None required.
- Can later connect to cosmetic store for premium emote packs.

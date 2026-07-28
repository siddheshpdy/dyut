# CrazyGames Opening, Bot Motion, and Economy Polish — Execution Plan

## Decisions

- New online matches and the CrazyGames first-session bot match start each active player with one piece at path index `2` (the second board square). Local/offline starts remain unchanged.
- The Void Rule remains available outside the portal build, but is disabled for every CrazyGames match, including instant multiplayer and the automatic first-session match.
- With `VITE_CG_ENABLE_ADS=false`, public online entry costs `200` coins and the disabled rewarded-ad row is hidden. Enabling the flag restores the `500`-coin entry and displays the ad-reward surface.
- Paid public matches award the human player `50` coins for each of their pieces that reaches the goal. Capture rewards are deliberately deferred: repeated captures are farmable until multiplayer actions and economy settlement are server-authoritative.
- Bot actions must wait for board movement animation to settle, then pause briefly before evaluating the next action. This includes the two actions created by a split roll.

## Implementation

1. Add an explicit starting-piece path-index field to game configuration/state. Seed the first piece for every active online player and for the portal intro only; preserve the normal locked-piece setup for local games. Carry the field through online state creation/sync.
2. Make portal rules deterministic: hide the portal Void control and force `isVoidRuleEnabled: false` through all portal match-start paths. Standalone controls keep their current behavior.
3. Publish Board animation busy/idle state through the existing browser event and have `useAIBot` defer its next decision until idle plus a fixed post-animation gap. This ensures a split action completes visibly before the remaining action can move or capture.
4. Derive public entry cost from the existing ad-release flag, and use that same value in reservations, pool calculation, lobby copy, and affordability checks. Gate the rewarded-ad dialog row behind the flag instead of showing a disabled placeholder.
5. Add an idempotent `goal_reward` economy event keyed by match, player, and piece index. Award it only for a local human in a public online match when their piece state reaches `999`; maintain a per-match event ledger so remounts, cloud sync, and repeated effects cannot duplicate payment.
6. Update README environment/economy documentation and add tests for initial pieces, portal Void defaults, bot split-motion wait, ads-off UI, 200-coin settlement behavior, and once-per-piece goal rewards.

## Acceptance checks

- A portal first-session game and a new online game show one piece per active player at path index 2; a new local game shows all pieces locked.
- CrazyGames matches cannot enable Void; standalone configuration remains unchanged.
- During a bot split move, the first movement finishes, an observable gap occurs, then the remaining movement/capture starts.
- Ads-disabled builds show no rewarded-ad placeholder and require 200 coins for public play; ads-enabled behavior retains the 500-coin amount and reward surface.
- A paid public human receives exactly 50 coins for each distinct piece reaching the goal, regardless of replayed sync/effect execution; no capture reward is issued.
- Unit and Playwright suites pass, including the updated public economy expectations.

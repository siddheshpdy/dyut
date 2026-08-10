# Dyut Local Test Completion Report

**Date:** 2026-08-01
**Target:** `http://localhost:5173/`
**Overall status:** **Not approved for full release** — local gameplay and automated checks pass; live online matchmaking/start has a blocking defect.

## Scope and evidence

| Area | Result | Evidence |
| --- | --- | --- |
| Development server | Pass | `GET /` returned HTTP 200 from `localhost:5173`. |
| Unit/component tests | Pass | `npm test`: 13 files, 74 tests passed. Covers rules, dice, AI, game state, AFK handling, cosmetics, progression, portal helpers, and board victory rendering. |
| Lint | Pass | `npm run lint` completed with zero warnings/errors. |
| Production build | Pass | `npm run build` completed successfully; 1,849 modules transformed. |
| Existing browser smoke tests | Pass | `npm run test:e2e`: 2/2 passed against the running server. |
| Information screens | Pass | Live browser run opened and returned from How to Play, Rules, History, and About Us. |
| Local game launch and turn | Pass | Live browser run launched Play Now, reached the board, dismissed the first-time helper, and completed a dice roll. |
| Desktop visual review | Pass | [Gameplay capture](artifacts/live-local-gameplay.png) shows no visible clipping or overlap at desktop size. |
| Live online lobby join | Partial pass | Two isolated browser profiles created/joined the same public lobby and both showed `CONNECTED`; the second profile claimed Player 2. |
| Live online match start / state sync | **Fail** | Host Start Match action did not transition either browser from the lobby to the board within 30 seconds. Therefore roll synchronization, turn authority, reconnect, AFK takeover, and live match completion could not be accepted. |
| Standalone private invite flow | **Fail** | The host's Player 1 seat is initially unclaimed; the guest can see Claim Seat before its anonymous identity is ready, then the app throws when the control is used. |

## Local gameplay result

The local browser procedure was run with a deterministic CrazyGames SDK mock only; game logic, rendering, and Firebase configuration remained the live application configuration.

1. Started from a clean browser profile.
2. Verified every information screen and returned to the lobby.
3. Started a Play Now local bot game.
4. Verified the board and Dice Tray rendered.
5. Rolled the dice and observed normal no-legal-move handling (`No Valid Moves — Skipping Turn`).

Command:

```powershell
node scripts/verify-live-local.mjs
```

Result:

```json
{"status":"passed","checks":["menu information screens","local bot match launch","first-turn dice roll"]}
```

## Online test result

The live online procedure used two independent Chromium contexts, each with its own anonymous Firebase account. It used the configured Firebase Realtime Database, not a mocked RTDB. Only the external CrazyGames SDK was mocked so portal login and ads could not affect the test.

Reproduction:

1. Browser A opens **Play Online**, creating a public lobby.
2. Browser B opens the generated `?join=<lobby-id>` URL.
3. Browser B claims Player 2 and both browsers show `CONNECTED`.
4. Browser A clicks **Start Match**.
5. Both remain in the waiting lobby; neither receives the Dice Tray/board within 30 seconds.

Observed console error:

```text
Error finding random game: Error: Permission denied
```

The error originates from the RTDB query in `matchmaking.js` (`findRandomPublicGame`). Lobby create and seat-claim writes did succeed, so the database rules currently permit only part of the expected public-match workflow.

### Configuration audit

No versioned Firebase Realtime Database rules file, `firebase.json`, or `.firebaserc` deployment manifest exists in this repository. The external rule set cannot therefore be reviewed or reproduced locally. This is material because the project plan explicitly requires anonymous authentication and RTDB rules for lobby/game membership. The Firebase console configuration is required before the remaining online test cases can be completed.

Command:

```powershell
node scripts/verify-live-online.mjs
```

Result: failed waiting for the Roll Dice control after Start Match. Diagnostic screenshots were captured at `artifacts/live-online-host-failure.png` and `artifacts/live-online-guest-failure.png`.

## Blocking finding

**ONLINE-001 — Public online match does not start after two clients join**

- **Severity:** Blocker for online release.
- **Impact:** Players can discover/create a lobby and join it, but cannot enter a shared game. All post-start online behavior is therefore unverified end-to-end.
- **Likely investigation points:** Firebase RTDB security rules for the `lobbies` query/update and start transition, plus confirmation that the `gameStarted`/`status` write is observed by both clients.
- **Evidence:** the two-client reproduction above and the captured failure screenshots.

## Additional online finding

**ONLINE-002 - Claim Seat is actionable before a guest identity exists**

- **Severity:** High.
- **Reproduction:** Run the standalone build (`VITE_CRAZYGAMES_BUILD=false`) on port 5175; create a private 1 vs 1 lobby, open the invite in a separate browser profile, then click the visible Claim Seat control.
- **Observed error:** `Cannot read properties of null (reading 'uid')` from `handleClaimSeat` in `UnifiedLobby.jsx`.
- **Impact:** The guest remains in the lobby and cannot claim a seat. The host's own Player 1 seat was also initially unclaimed, despite the UI showing an anonymous-session profile state.
- **Required fix direction:** Disable or hide Claim Seat until `user?.uid` is available, and do not create the host seat with a null UID. Surface a clear authentication/loading state instead.

## Remaining verification after ONLINE-001 is resolved

1. Run the two-client test again and confirm both clients reach the board.
2. Verify one host roll synchronizes to the guest and that only the active player can act.
3. Play or seed a short online match to verify victory, rewards, cleanup, and both players’ return flow.
4. Verify reconnect, AFK timeout/takeover, public-match abandonment, and private invitation flow against the configured RTDB rules.
5. Repeat the visual check at mobile and desktop sizes after the online board is available.
6. Retest the private invite path once ONLINE-002 is fixed, including a guest seat claim and host start.

## Test support added

- `scripts/verify-live-local.mjs` - repeatable live local UI check.
- `scripts/verify-live-online.mjs` - repeatable two-client live RTDB check with diagnostics on failure.
- `scripts/verify-live-private-online.mjs` - repeatable standalone private-invite diagnostic.

No game mechanics were changed during this test pass.

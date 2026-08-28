# Phase 29.3 Execution Plan: Firebase Functions 2nd Gen

This execution plan is the implementation checklist for
[29-3-firebase-functions-server-authority-plan.md](./29-3-firebase-functions-server-authority-plan.md).
Each stage must leave the current app runnable and independently reversible.

## Stage 0 — Baseline and gates

- Record current `npm.cmd test`, lint, standalone build, CrazyGames build, and
  Playwright results.
- Freeze `LogicAndRules.md` as the rule authority.
- Add a server-authority capability flag whose default preserves current
  behaviour until the corresponding server stage is verified.
- Add a migration log with stage, commit, emulator result, and rollback flag.

**Gate:** current local/AI/tutorial/UI tests remain green.

## Stage 1 — Functions and emulator foundation

**Progress:** Foundation implemented and verified locally. The current slice
adds the Functions package, 2nd-gen runtime config, callable probes, Firebase
Emulator Suite config, rules, indexes, and both unit/emulator integration
commands. A portable Java 17 runtime was used for the local Auth/Firestore/
RTDB/Functions suite.

- Add `functions/package.json` with `firebase-admin`, `firebase-functions`, and
  Node.js 20 or 22.
- Add `functions/src/index.js`, shared error helpers, auth/App Check helpers,
  and region/runtime options.
- Add `firebase.json`, `.firebaserc`, Firestore/RTDB rules, indexes, and
  Emulator Suite ports. Keep `firebase.json` production-facing and use
  `firebase.emulator.json` for the local project-namespace database used by
  the Emulator Suite.
- Configure the RTDB completion trigger with `DATABASE_REGION` matching the
  deployed Realtime Database instance; callable Functions use `FUNCTION_REGION`.
- Add `npm.cmd run test:functions` and
  `npm.cmd run test:functions:emulator` / `npm.cmd run test:emulators`
  scripts. The Functions-only smoke script exercises the deployed callable
  health endpoint; the full command additionally requires Java.
- Connect the browser Auth, Firestore, RTDB, and Functions clients to the
  emulators when `VITE_USE_FIREBASE_EMULATORS=true`, so authority browser tests
  cannot accidentally use production data.
- Add a health callable and verify local client-to-emulator connectivity.

**Gate:** passed. Functions loaded in the emulator, the signed-in integration
client completed the callable flow, and the two-client host/guest smoke test
observed the same authoritative version and turn queue.

## Stage 2 — Shared rule extraction

**Progress:** Initial server rule extraction implemented and covered by Node
tests, including browser/server board-path and representative movement/spawn
parity fixtures. DOM-free server copies now cover board
mapping, safe zones, occupancy, spawn checks, movement validation, and combat
decisions used by the authoritative engine.

- Move or duplicate pure board mapping and game-transition helpers into a
  deployable shared module.
- Keep browser modules as compatibility re-exports where needed.
- Do not include React, DOM, Firebase client SDK, timers, or browser storage in
  shared server logic.
- Run existing `gameLogic.test.js`, `GameContext.test.js`, and new Node tests
  against the same shared rule fixtures.

**Gate:** client and server produce identical states for all current rule
fixtures, including Pair Shield, Dual Spawn, Assassin, Void, Blood Debt, and
exact victory.

## Stage 3 — Authoritative online commands

**Progress:** Callable roll/action path implemented behind the capability flag;
the previous strict emulator run passed, and the current gate now includes
delayed-retry replay, second-disconnect settlement, and paid-forfeit checks.
`rollGameDice` and
`submitGameAction` use RTDB transactions with server dice, action IDs, version
checks, duplicate replay results, and validation for current gameplay actions.
Lobby creation, public search, seat claims, start, game initialization,
heartbeat, host recovery, leave, and finalization are now callable-backed too.
A lobby start persists a temporary `starting` marker and its baseline seat set;
the host can safely retry after an interrupted reservation sequence, with
attempted wallet reservations refunded before a failed start is rolled back.
Public reservation/refund commands also verify the caller's claimed seat and
only allow refunds while the public lobby is still waiting or starting.
Online initialization now fixes the initial piece position and checks human
piece designs against server-owned wallet entitlements.
A dedicated `scripts/two-client-authority-smoke.mjs` now exercises two
authenticated Firebase client SDKs against the emulator, including snapshot
convergence, duplicate replay, and forged-turn rejection.

- Implement `createMatch`, `claimSeat`, and `startMatch` authorization.
- Implement `rollDice` with server-generated faces and action idempotency.
- Implement `executeMove` for every existing action payload:
  full move, split move, spawn, pair attack, dual spawn, clear queue, and end
  turn.
- Store `stateVersion`, `lastActionId`, `actionResults`, and server timestamps
  in the RTDB game record.
- Reject direct client writes to authoritative fields in emulator rules.
- Add reconnect handling that reads the last committed snapshot.

**Gate:** the local integration test proves server dice, out-of-turn and stale
action rejection, duplicate replay, direct-write denial, and includes the
two-client convergence and paid-forfeit checks. The latest execution is
pending a Java 17+ runtime; deployed two-browser reconnect and staging
validation remain.

## Stage 4 — Client online migration

**Progress:** Guarded bridge implemented; direct-write fallback remains active
by default until emulator/staging validation. Online protected actions route
through `serverAuthorityClient.js` when explicitly enabled, while DiceTray
avoids submitting a second browser-derived Void command.
The lobby and game lifecycle paths, economy service, and profile-name update
also switch to callable functions under the same flag.
The standalone and CrazyGames-capability Playwright smoke suite now passes
16/16 tests, covering local/private flows, rewards/goals, public-match
disclosures, compact layout, and portal cosmetic purchase behavior.

- Add `functionsClient.js` with typed command wrappers and emulator support.
- Update `GameContext.jsx` so online human actions call Functions.
- Keep local and AI dispatch unchanged.
- Remove online direct `update(gameRef, nextState)` authority writes after the
  server path is enabled.
- Render pending/rejected/reconnecting states without hiding required controls.
- Keep the current header, board, DiceTray, queue, lobby, rewards, and popup
  placement unchanged.

**Gate:** standalone and CrazyGames-capability browser tests pass at the full
  viewport matrix; local mode still starts and plays without Functions.

## Stage 5 — Authoritative completion and statistics

**Progress:** Completion/stat projection and the RTDB completion trigger are
implemented and covered by the emulator flow. `recordMatchCompletion` remains an idempotent compatibility
callable, while `onGameFinished` records every active participant from the
server-derived winner and materializes `leaderboardEntries`; disconnected
paid human seats remain included after bot takeover so forfeits still settle
the full entry pool; goal progress now
derives wins/captures from the authoritative game instead of trusting client
values.

- Implement server-side completion validation from authoritative state.
- Move profile stat updates out of `firebaseSetup.updateUserStats` for online
  games.
- Add idempotent `matchSettlements/{matchId}` and completion event IDs.
- Project wins, games played, XP, goals, and mode stats from the verified result.
- Keep portal/platform statistics separate where CrazyGames owns the identity.

**Gate:** replaying completion, reconnecting, or mounting two clients produces
one result and one stat update.

## Stage 6 — Wallet and public-match economy

**Progress:** Server wallet/ledger commands, server-side public entry
reservation, completion settlement, and client routing are implemented behind
the capability flag. The emulator flow covers idempotent daily rewards and
public reservation/settlement. Rewarded-ad multiplier claims now fail closed
until a signed provider proof or webhook is available; concurrency and
staging gates remain before production use.

- Add wallet projection and append-only ledger repositories.
- Implement daily reward, goal claims, cosmetic coin purchase, reservation,
  settlement, and refund functions.
- Remove client authority over balance, ledger, inventory, fee, pool, and payout.
- Return server-confirmed economy events to the existing UI.
- Leave offline, Play with Friends, and Instant Multiplayer free.

**Gate:** emulator concurrency tests prove no duplicate grants, overspending,
double settlement, or lost refunds; public entry remains disabled until this
gate passes.

## Stage 7 — Leaderboard and projections

**Progress:** Client reads now target public-safe `leaderboardEntries`, and
verified completion writes the initial projection; this is covered by the
emulator flow. Scheduled/global/weekly
projections, opt-out filtering, and emulator rule tests remain.

- Create public-safe leaderboard documents.
- Update `leaderboardService.js` to read only those documents.
- Materialize global/weekly/regional boards from verified stats.
- Add opt-out, deleted/banned-user filtering, tie handling, and rank tests.
- Keep CrazyGames platform submission separate from website rankings.

**Gate:** leaderboard queries cannot read private profile fields and all rows
come from server-verified results.

## Stage 8 — Staging, rollout, and fallback removal

- Deploy rules and Functions to a staging Firebase project.
- Run emulator tests, two-browser staging tests, and viewport captures.
- Enable server authority for internal users first, then a controlled rollout.
- Monitor function errors, rejected actions, latency, RTDB writes, and ledger
  reconciliation.
- Disable direct-write fallback only after rollback has been tested.
- Deploy production Functions and rules separately from UI activation.

**Final gate:** all current tests/builds pass, server-authority acceptance
criteria pass, and the fallback can be removed without changing UI behaviour.

## Staging deployment runbook

Run these steps only with an authenticated Firebase CLI and a dedicated
staging project. Record each result in the [migration log](./29-3-firebase-functions-server-authority-migration-log.md).

1. Select the staging project with `firebase use <staging-project>` and verify
   the project ID, RTDB instance, Functions region, and Firestore database.
2. Copy `functions/.env.example` to `functions/.env` and set the staging
   values. Keep `ENFORCE_APP_CHECK=false` only for the first emulator/staging
   smoke test; enable it before production traffic.
3. Install dependencies with `npm ci` and `npm --prefix functions ci`.
4. Deploy infrastructure separately with
   `firebase deploy --only functions,firestore,database`.
5. Run `npm run test:emulators`, then run the two-browser staging smoke flow
   with `VITE_SERVER_AUTHORITY_ENABLED=true` and staging Firebase variables.
6. Verify a private match, public paid match, duplicate retry, reconnect,
   host recovery, completion projection, wallet ledger, and leaderboard row.
7. Enable the flag for internal users only, monitor rejected commands and
   ledger reconciliation, then expand the rollout gradually.

## Rollback execution

- Set `VITE_SERVER_AUTHORITY_ENABLED=false` for non-value-bearing staging or
  local traffic if callable gameplay is unavailable.
- Disable public entry, rewards, purchases, or settlement independently if an
  economy defect is detected.
- Do not delete wallet ledger events, settlements, or authoritative game
  records during rollback; reconcile them after service recovery.
- Keep the Functions and rules deployment available while the client flag is
  rolled back so existing authoritative matches can complete safely.

## Rollback rules

- Never roll back by deleting ledger entries or rewriting settlements.
- Disable public entry/rewards/purchases independently if economy issues occur.
- Keep free offline/local/friends play available during backend incidents.
- Preserve the last authoritative RTDB snapshot for reconnect/debugging.
- Re-enable client fallback only for non-valuable staging/local flows, never for
  production coin or payout decisions.

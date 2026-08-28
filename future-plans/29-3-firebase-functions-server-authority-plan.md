# Phase 29.3: Firebase Functions 2nd-Gen Server Authority Migration Plan

**Status:** In progress. The compatibility-preserving Functions foundation,
shared rule engine, callable game commands, and authoritative completion/stat
projection are implemented behind `VITE_SERVER_AUTHORITY_ENABLED`. The local
Auth/Firestore/RTDB/Functions emulator acceptance flow now passes, while
two-browser staging validation and production rollout remain before the flag
can be enabled for users.

**Objective:** Make online gameplay, match completion, statistics, rewards,
leaderboards, and public-match economy decisions originate from trusted
Firebase Cloud Functions 2nd gen while keeping offline, local, bot, tutorial,
and existing UI flows unchanged.

**Rule authority:** [LogicAndRules.md](../LogicAndRules.md)

**UI authority:** [AI_UI_FUNCTIONALITY_PRESERVATION.md](../AI_UI_FUNCTIONALITY_PRESERVATION.md)

## Current boundary

The current browser client:

- calculates reducer transitions in `GameContext.jsx`;
- writes online game state directly to RTDB;
- updates Firestore profile statistics from `firebaseSetup.js`;
- performs economy mutations in `economyService.js` using Firestore,
  localStorage, or CrazyGames Data;
- queries the private `users` collection for the website leaderboard.

These paths remain available only as a staged fallback until their equivalent
server path passes emulator and browser gates. No UI redesign is part of this
migration.

### Implemented in the current migration slice

- `functions/src/shared/boardMapping.js` and `functions/src/shared/gameLogic.js`
  contain deployable, DOM-free copies of the current path, safe-zone,
  occupancy, spawn, and movement validation rules.
- `functions/src/game/engine.js` validates server-generated dice, Void Rule,
  movement, split rolls, spawning, Pair Shield attacks, Dual Spawn attacks,
  turn ownership, action versions, AFK takeover, and terminal wins.
- `functions/src/game/commands.js` exposes idempotent `rollGameDice` and
  `submitGameAction` callable functions using RTDB transactions.
- `functions/src/stats.js` exposes idempotent `recordMatchCompletion`, deriving
  the winner and mode from the completed RTDB game before incrementing stats.
- `functions/src/game/triggers.js` observes server-authority game completion and
  records every human participant's stats, goals, and public settlement without
  requiring a client completion callback, including a paid human seat that was
  converted to a bot after disconnect. Server-created games carry an
  explicit `serverAuthority` marker so legacy fallback games are not double
  counted.
- `functions/src/economy/commands.js` exposes server wallet reads and
  idempotent reward, goal, cosmetic, public-entry, settlement, and refund
  commands. Public entry fees are reserved at server-side lobby start. Wallet
  state is kept in `wallets/{uid}` and committed events are mirrored to
  `walletLedger`.
- `functions/src/lobby/commands.js` and `functions/src/game/lifecycle.js`
  own lobby creation/search/seat/start/heartbeat and game initialization,
  host recovery, leave, and finalization. Lobby start locks the final seat set
  with a resumable marker and refunds attempted reservations on failure, so a
  process interruption between the lock and wallet reservations can be
  retried safely. `leaderboardEntries` is materialized
  from verified match completion rather than queried from private profiles.
- `serverAuthorityClient.js` and the guarded `GameContext.jsx` bridge route
  online protected actions, lifecycle operations, online completion stats, and
  economy mutations through those callables only when the capability flag is
  explicitly enabled. Offline, local, bot, tutorial, CrazyGames Data, and
  default online fallback behavior are unchanged.

### Verification update — 2026-08-15

The last successful full Emulator Suite run passed the Functions unit suite
and integration flow. That flow verifies authenticated lobby creation and seat
claims, server initialization and dice, out-of-turn/stale-action rejection,
duplicate command replay, direct RTDB write denial, idempotent daily rewards,
completion-triggered stats/goals, and public entry reservation/settlement.
The two-client convergence and paid-forfeit checks are part of the same
command, and the full workspace rerun passed after isolating the emulator
namespace in `firebase.emulator.json`. Production configuration continues to
target `onlinedyut-default-rtdb`; the emulator uses the project namespace so
the Admin SDK, browser SDK, and rules evaluate the same local data.
The remaining gates are staging deployment, two-browser reconnect validation,
App Check enforcement, and controlled rollout; the authority flag remains off.

## Target architecture

```text
React UI
  └─ client adapters (`firebase/functions` callable requests)
       ├─ Firebase Auth + App Check
       └─ Cloud Functions 2nd gen
            ├─ authenticated game commands
            ├─ authoritative RTDB transactions
            ├─ match completion and stat projection
            ├─ wallet ledger and economy commands
            └─ public leaderboard materialization

Storage
  ├─ RTDB: live lobbies, presence, and authoritative active games
  └─ Firestore: profiles, wallet ledger, settlements, inventory, leaderboards
```

## Trust invariants

1. A client sends intent, never dice values or a new game state.
2. The server verifies authentication, App Check where enabled, membership,
   turn ownership, action version, and idempotency key.
3. Dice are generated on the server using the Dyut faces `[1, 3, 4, 6]`.
4. The server applies the existing rules without changing Void Rule, Max Value
   Rule, Pair Shield, Assassin, Blood Debt, exact finish, or team behaviour.
5. Only authoritative state can complete a match or issue stats, XP, goals,
   rewards, entry reservations, refunds, or payouts.
6. Repeating a request returns the original committed result from a bounded
   server-side action-result cache and does not duplicate a transition or
   ledger entry.
7. Local/offline and AI games keep their existing reducer path and do not wait
   for Functions. Offline-only profile counters remain client-owned and are
   never used as the source for online rankings or payouts.
8. Callable gameplay commands reject legacy client-authoritative game records;
   only games created and marked by the server lifecycle can use the authority
   engine.
9. Public-entry reservation and refund callables verify both the authenticated
   participant seat and the lobby's refundable lifecycle state; profile edits
   cannot create leaderboard rows without a verified completion.
10. Online initialization fixes the starting position and resolves each human
    player's piece design against the server wallet entitlement; forged or
    unknown designs fall back to the free classic design.

## Data ownership

### RTDB

- `lobbies/{lobbyId}`: server-validated lobby status, seats, and membership.
- `games/{gameId}`: server-owned state, version, current turn, dice queue,
  pieces, status, and action metadata.
- `presence/{gameId}/{uid}`: client heartbeat and connection presence only.

Clients may read authorized games and submit presence. Clients must not write
authoritative dice, pieces, turns, winners, or settlement status directly.

### Firestore

- `users/{uid}`: identity, preferences, and noncompetitive offline counters;
  online stats and leaderboard projections are written by Functions.
- `wallets/{uid}`: current projection, server-only writes.
- `walletLedger/{entryId}`: append-only server ledger, server-only writes.
- `matchSettlements/{matchId}`: immutable settlement result, server-only writes.
- `leaderboards/{boardId}/entries/{uid}`: public-safe materialized ranking data.
- `inventory/{uid}/items/{itemId}`: server-owned cosmetic entitlements.

## Function groups

### Gameplay

- `createMatch`
- `claimSeat`
- `startMatch`
- `rollDice`
- `executeMove`
- `leaveMatch`
- `completeMatch`

`rollDice` and `executeMove` are the first authority boundary. They must use
transactional RTDB updates and an action ID/version check.

### Account and economy

- `getOrCreateWallet`
- `claimDailyReward`
- `recordGoalProgress`
- `claimGoalReward`
- `purchasePieceSkin`
- `reservePublicMatchEntry`
- `settlePublicMatch`
- `refundPublicMatchEntry`

Rewarded-ad and purchase functions remain disabled until the source event or
verified webhook can be validated server-side.

### Projections

- `onAuthoritativeMatchCompleted`: write stats, XP, goals, and settlement.
- `materializeGlobalLeaderboard`: scheduled ranking projection.
- `materializeWeeklyRegionalLeaderboards`: scheduled projection after privacy
  and opt-out rules are implemented.

## Required client migration

1. Add a Functions adapter using `httpsCallable` and an emulator connection in
   development.
2. Add `serverAuthority` capability/configuration to online match setup.
3. Send online intents through Functions and consume RTDB snapshots as the
   authoritative state.
4. Stop direct client writes to `games/{id}` for authoritative fields.
5. Stop calling `updateUserStats` and client settlement after authoritative
   completion; render the server-confirmed result instead.
6. Keep local/AI reducer dispatch unchanged.
7. Keep old fallback code only behind a temporary migration flag with visible
   telemetry; remove it after staging and production gates pass.

## Security and operations

- Add `firebase.json`, `.firebaserc`, `firestore.rules`,
  `database.rules.json`, `firestore.indexes.json`, and Emulator Suite config.
- Use a dedicated Functions package with Node.js 20 or 22.
- Use Secret Manager for CrazyGames/backend/payment secrets.
- Enforce App Check on sensitive callable functions after client setup.
- Set explicit region, timeout, memory, concurrency, and max-instance limits.
- Add structured logs, correlation IDs, rejection reasons, and reconciliation
  tools without logging tokens or private profile data.

## Completion criteria

- Emulator tests prove unauthorized direct writes fail.
- Forged dice, illegal moves, stale actions, wrong turns, duplicate actions,
  and post-finish actions are rejected.
- Two browser clients converge after every server action and reconnect.
- Existing game-rule tests remain green with shared rule fixtures.
- Offline/AI/tutorial flows remain unchanged.
- Economy ledger projection equals the sum of committed entries.
- Leaderboard data contains no private user fields.
- Existing UI viewport and preservation gates pass before removing fallback.

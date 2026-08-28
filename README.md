# Dyut

Dyut is a browser-based digital adaptation of the traditional Indian cross-and-circle board game. This project is built with React, Vite, and Tailwind CSS, with a custom rules engine designed around Dyut's specific movement, combat, and turn-priority rules rather than standard Ludo behavior.

## Current Status

The repository is already beyond prototype stage. It currently includes:

- Local play with 1v1, 2v2 team mode, and 4-player free-for-all configurations
- Centralized game-state management using React `useReducer`
- Custom Dyut dice using only faces `1`, `3`, `4`, and `6`
- Doubles streaks, queued turns, and the `1+3` Void Rule
- Board path generation and logical-to-visual mapping for the cross layout
- Spawn rules, movement priority, pair shields, pair attacks, safe zones, assassin-style spawn captures, blood debt, and terminal victory handling that locks further play until a new game starts
- Single-player bot support with heuristic AI, Max Value-aware bot decisions, queued-roll fallback, and team-mode effective-player ownership
- Firebase authentication, player profiles, and online multiplayer sync
- Firebase Functions 2nd-gen server-authority migration. The Functions package contains the shared board/rule engine, server-generated Dyut dice, callable versioned game/lobby commands, server-owned wallet/ledger mutations, RTDB-triggered completion settlement, verified stats and leaderboard projection, entitlement-checked piece designs, and emulator configuration. The client bridge is opt-in with `VITE_SERVER_AUTHORITY_ENABLED=true` while emulator/staging gates are verified; offline play remains reducer-driven.
- Profile statistics separated into Offline, Online Match, and Vs Friends categories, with a website leaderboard showing ranked players, wins, and games played. CrazyGames profile scores remain separate and are submitted to the CrazyGames platform leaderboard when that feature is enabled for the game
- Temple Coin economy with a manually claimed 500-coin UTC daily reward, visible daily/weekly online-play goals with explicit claims, and an optional ad-based reward multiplier. Public Online Match uses a 200-coin entry while ads are disabled (500 when `VITE_CG_ENABLE_ADS=true`), a 10% match fee, and idempotent prize settlement. 1v1/FFA award the remaining pool to one winner, while public 2v2 divides 90% of the paid human-entry pool equally among winning human teammates. Bots neither pay an entry nor receive a prize share. Offline play, Play with Friends, and CrazyGames Instant Multiplayer remain free
- A Collection beside Rewards keeps the Classic design free and lets players permanently purchase Lotus (750 coins), Chakra (1,200), Royal (2,000), Conch (3,000), Peacock (4,500), Eclipse (6,500), Temple (9,000), and Celestial (12,000) with earned Temple Coins. Every paid design costs more than a single 500-coin daily reward. Collection-equipped designs are carried in match snapshots independently from seat color, so players may choose the same design while unique seat colors preserve player identity; an explicit Player 1 Collection choice also removes the conflicting Player 1 design selector from the lobby
- Public/private lobby flows, host migration, true per-turn countdowns on desktop and mobile, 60-second local turns, 30-second online turns, timer refresh on dice roll, AFK handling with visible strike warnings, host-owned auto-roll handoff for bot/AFK-controlled turns (including recovery of missing bot ownership metadata from legacy cached clients, so bot-filled seats do not wait for the turn timeout), bot takeover for disconnected/AFK online players, automatic online match finish with a forfeit winner when fewer than two human seats remain, player reclaim on return before permanent takeover, and signed-in account-backed resume for resumable private online matches across devices
- Mobile and desktop play both support rolling directly from the dice panel, with the dice area muted for inactive turns and gold-highlighted when the local human player can roll
- Tutorial, rules, history, and about screens
- First-time players see a compact in-game helper for rolling, spawning, and moving without opening the full tutorial during gameplay
- English, Hindi, and Marathi localization
- CrazyGames portal integration hooks, including first-time-account onboarding that drops signed-in new portal players straight into a local bot match, an opening piece on the second path square for portal and online games, the Void Rule disabled in portal matches, instant-multiplayer launches that create a private four-player lobby with three invite slots, standard local play opening the Human/Bot seat-selection lobby, SDK mute compliance, CrazyGames username display in portal lobbies, JSON-serialized portal stats, and Data-module-backed offline resume mirroring
- Victory actions now offer a same-configuration New Game and a direct home shortcut; both CrazyGames and standalone menus label the invite-only private flow as Play with Friends

Resume behavior is intentionally split by mode:

- Offline/local games resume only on the same device using local storage; in CrazyGames portal builds the same offline resume payload is also saved through the CrazyGames Data module
- Starting a new offline/local match clears the previous local resume snapshot; only explicit resume uses the saved local state
- Resumable private online matches store their reconnect target on the signed-in Firebase account so the same player can reconnect from another device
- The resume dialog appears from the main menu before entering local or online setup, avoiding late prompts after an online lobby has already started; the offline/local dialog offers Resume Existing, New Game, and Go to Menu actions

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Firebase Authentication
- Firebase Firestore
- Firebase Realtime Database
- Vitest + Testing Library

## Core Architecture

Key files:

- [GameContext.jsx](./GameContext.jsx): global reducer, turn state, local/online turn-timer enforcement, online sync, AFK handling, and game lifecycle
- [gameLogic.js](./gameLogic.js): move validation, spawn checks, collision logic, proxy-player logic for team mode, and auto-move helpers
- [boardMapping.js](./boardMapping.js): board cell generation, player path generation, and safe-zone mapping
- [Board.jsx](./Board.jsx): board rendering, piece animation, move selection, and victory presentation
- [DiceTray.jsx](./DiceTray.jsx): dice-panel rolling, queue display, auto-end-turn flow, and Void Rule UX
- [UnifiedLobby.jsx](./UnifiedLobby.jsx): local/online match setup, seat claiming, lobby syncing, and profile controls
- [aiLogic.js](./aiLogic.js): bot heuristics and move scoring
- [firebaseSetup.js](./firebaseSetup.js): Firebase initialization, auth helpers, and profile/stat updates
- [economy.js](./economy.js): integer-only wallet, cosmetic purchases, daily/weekly goal progress, claim, multiplier, entry, pool, fee, payout, draw-refund, and idempotency rules
- [economyService.js](./economyService.js): standalone, anonymous/local, and CrazyGames economy persistence adapters
- [EconomyContext.jsx](./EconomyContext.jsx): wallet loading, manual daily/goal reward claims, optional ad multipliers, and app-wide balance/settlement state
- [pieceSkins.js](./pieceSkins.js): safe piece-design catalog, default fallback, and stable design identifiers
- [playerStats.js](./playerStats.js): match-mode classification and normalized per-mode profile statistics
- [leaderboardService.js](./leaderboardService.js): website Firestore leaderboard queries
- [crazyGamesLeaderboard.js](./crazyGamesLeaderboard.js): CrazyGames score encryption and platform leaderboard submission adapter
- [functions/src/game/engine.js](./functions/src/game/engine.js): server-side command validation and authoritative state transitions
- Server-authoritative roll and move callables return the committed game snapshot to the browser for immediate reconciliation; the RTDB listener remains the shared source of truth and ignores stale snapshots by version. Dice rolling animation remains active until the callable returns a committed version, while a failed call clears the animation safely. Online lobby actions stay disabled until the account economy has loaded.
- [functions/src/game/commands.js](./functions/src/game/commands.js): callable 2nd-gen game command handlers
- [functions/src/game/lifecycle.js](./functions/src/game/lifecycle.js): server-owned game initialization, heartbeat, host recovery, leave, and finalization
- [functions/src/lobby/commands.js](./functions/src/lobby/commands.js): server-owned lobby snapshots, creation, search, seat claims, updates, and start
- [functions/src/economy/commands.js](./functions/src/economy/commands.js): wallet, ledger, rewards, cosmetics, entry, settlement, and refund callables
- [functions/src/stats.js](./functions/src/stats.js): verified completion stats and public leaderboard projection
- [future-plans/29-3-firebase-functions-server-authority-plan.md](./future-plans/29-3-firebase-functions-server-authority-plan.md): migration architecture and invariants
- [future-plans/29-3-firebase-functions-server-authority-execplan.md](./future-plans/29-3-firebase-functions-server-authority-execplan.md): staged execution and rollback plan
- [future-plans/29-3-firebase-functions-server-authority-migration-log.md](./future-plans/29-3-firebase-functions-server-authority-migration-log.md): rollout evidence and activation record

## Rules Coverage

The project follows the Dyut rules documented in [LogicAndRules.md](./LogicAndRules.md), including:

- strict dice faces `[1, 3, 4, 6]`
- doubles chaining into queued turns
- Void Rule on exact `1 + 3`
- priority-based movement resolution
- safe zones and occupancy limits
- pair shield defense and coordinated pair attacks
- dual-spawn pair breaches on valid safe-zone entries
- blood debt before entering the home stretch
- team-mode blood debt sharing after a capture

## Project Docs

These files are the main planning/reference docs in the repo:

- [LogicAndRules.md](./LogicAndRules.md): source of truth for gameplay rules
- [featurePlan.md](./featurePlan.md): implementation roadmap and completed phase tracking
- [futureEnhancements.md](./futureEnhancements.md): longer-term roadmap for monetization, retention, infrastructure, and compliance
- [future-plans/monetization-strategy.md](./future-plans/monetization-strategy.md): current CrazyGames and standalone-web economy, ads, cosmetics, and payment strategy
- [future-plans/monetization-execution-plan.md](./future-plans/monetization-execution-plan.md): phased implementation, code-impact, backend, and Playwright requirements for monetization
- [agents.md](./agents.md): high-level AI assistant context for the project
- [webPortalPlan.md](./webPortalPlan.md): web portal packaging/integration notes
- [CrazyGamesQA.md](./CrazyGamesQA.md): portal QA checklist for screen sizes, SDK behavior, multiplayer, ads, and save/resume

Note: [styles.md](./styles.md) does not currently match this project and appears to be leftover from a different app.

## Development

Install dependencies:

```bash
npm install
```

Run the Vite dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Build for CrazyGames mode:

```bash
npm run build:crazygames
```

Run tests:

```bash
npm test
```

Run the server-side rule-engine tests:

```bash
npm run test:functions
```

Run the Functions-only emulator health smoke check (does not require the
Firestore/RTDB/Auth emulator Java runtime):

```bash
npm run test:functions:emulator
```

Run the full signed-in Firebase Emulator Suite acceptance flow (requires Java
17+):

```bash
npm run test:emulators
```

This verifies callable lobby/game commands, server-generated dice, rejected
forged/stale actions and direct RTDB writes, duplicate-command replay,
idempotent rewards, completion projections, public-match settlement including
paid-player forfeits, and two-client snapshot convergence. The command uses
`firebase.emulator.json` so local RTDB rules target the emulator project
namespace; production deployment continues to use `firebase.json`. It requires
Java 17+ for the Firebase emulators.

The `Firebase Functions authority gate` CI job installs Java 17, runs the
Functions unit suite, and executes the emulator plus two-client acceptance
flow on every push and pull request.

Run local browser UI and functionality tests in the installed Google Chrome:

```bash
npm run test:ui
```

Useful browser-test variants:

```bash
npm run test:ui:headed
npm run test:ui:debug
npm run test:ui:report
npm run test:all
```

Playwright starts a temporary Vite server on `127.0.0.1:4173` unless `PLAYWRIGHT_BASE_URL` points to an already-running server. The suite covers responsive menu layout, local game startup, Play with Friends navigation, victory controls, long-name ellipsis positioning, manual daily/goal reward claims, public-match fee disclosure, public 2v2 selection and human-only prize-split disclosure, and insufficient-balance behavior. Failure screenshots and traces are written under ignored `artifacts/` and `e2e/test-output/` directories.

## Environment

Start from [`.env.example`](/E:/git/dev/dyut/.env.example) and copy it to `.env`:

```powershell
Copy-Item .env.example .env
Copy-Item functions/.env.example functions/.env
```

Then replace the `replace_with_...` values with the Firebase Web App settings
from Firebase Console. The project expects these Firebase environment variables:

The Functions package targets Node.js 20. Use Node.js 20 when running the
Firebase Functions emulator or deploying Functions; a newer local Node version
may be accepted by the emulator with a warning, but it is not the configured
runtime.

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_DATABASE_URL`

There is also CrazyGames-specific behavior gated by `VITE_CRAZYGAMES_BUILD`.
`VITE_SERVER_AUTHORITY_ENABLED` enables the online callable-command bridge. Enable it only after the matching project's Functions and RTDB rules are deployed. Records created by the former direct-write client are not migrated; the client clears their resume pointer and asks the player to start a new server-owned match.
`VITE_FUNCTIONS_REGION` selects the deployed Functions region, defaulting to `asia-south1`; it must match `DYUT_FUNCTION_REGION` in `functions/.env` (`FUNCTION_REGION` is reserved by Firebase and must not be added to dotenv files).
`VITE_USE_FIREBASE_EMULATORS=true` connects Auth, Firestore, RTDB, and Functions to the local Emulator Suite for browser authority testing.
Server-authority private lobby screens poll the authenticated `getLobby` callable while waiting; private lobby RTDB reads remain restricted to the host and claimed participants.
`VITE_CG_ENABLE_ADS` gates ad behavior; the Basic Launch portal build keeps this set to `false`.
Functions deployment values are documented in [functions/.env.example](/E:/git/dev/dyut/functions/.env.example); keep the server `CG_ENABLE_ADS` value aligned with the web build before enabling paid public matches.
`VITE_USE_FIREBASE_EMULATORS=false` is required for a deployed build. Set `VITE_SERVER_AUTHORITY_ENABLED=true` only when the deployed Functions region and Firebase project match the web build. Firebase Admin credentials are provided by Firebase/GCP and are not added to the browser `.env` file.
`VITE_CRAZYGAMES_LEADERBOARD_ENCRYPTION_KEY` is left blank until CrazyGames enables the game leaderboard; it is used only by the portal score-submission adapter and is not used for website rankings.
`VITE_ADS_PROVIDER` selects `crazygames`, `google`, `none`, or `auto` (the default, which chooses CrazyGames for portal builds and Google H5 Games Ads for standalone builds). Portal builds always resolve to the CrazyGames SDK provider for platform compliance. Google standalone builds use publisher ID `ca-pub-8676646466866124` by default; `VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-...` can override it for another deployment.
The game uses rewarded ads only: banners and midgame interstitials are not requested. When ads are disabled, the rewarded-ad placeholder and multiplier offer are hidden, and paid public matches use the 200-coin entry amount. Enabling the existing `VITE_CG_ENABLE_ADS=true` flag shows the post-claim reward popup; the player receives the base reward first and can receive one idempotent 2x bonus only after the rewarded ad completes. Local QA can simulate the ad with `VITE_CG_ENABLE_ADS=true` and `?qa=economy-ads`.

Gameplay timing can be tuned with positive whole-number millisecond values:

- `VITE_ONLINE_TURN_TIMEOUT_MS` controls online turn duration, default `30000`
- `VITE_LOCAL_TURN_TIMEOUT_MS` controls local/offline turn duration, default `60000`
- `VITE_TURN_TIMER_WARNING_MS` controls the warning threshold, default `10000`
- `VITE_AFK_BOT_TAKEOVER_STRIKES` controls AFK strikes before bot takeover, default `6`

## Firebase environments and deployment

The repository supports separate Firebase testing and production projects. Keep
the project IDs, Realtime Database URLs, and Firebase Web App configuration in
the hosting provider's environment variables or GitHub Environment Secrets;
never commit `.env`, `functions/.env`, service-account JSON files, private keys,
or access tokens. Firebase Web App configuration is public browser configuration
and is injected at build time with `VITE_*` variables.

Use Firebase project aliases and an explicit project on every deployment:

```powershell
firebase use --add
firebase deploy --project TEST_PROJECT_ID --only functions,database,firestore
firebase deploy --project PRODUCTION_PROJECT_ID --only functions,database,firestore
```

The callable Functions run in `asia-south1`. Realtime Database triggers must
run in each project's Realtime Database instance region. The legacy
`onlinedyut` project uses `us-central1`; the newer project should use the
region shown in its Firebase Console (currently `asia-southeast1`). Set that
project-specific value as `DATABASE_REGION` in the ignored `functions/.env`
before each deployment. If a project uses a different RTDB instance name,
deploy its rules with a project-specific Firebase configuration file rather
than changing credentials in source control.
The Functions deployment should provide a project-specific `DATABASE_URL` in
the ignored `functions/.env` or deployment secret so the Admin SDK connects to
the correct RTDB instance during deployment analysis and runtime. If it is
omitted, the Admin bootstrap derives the default RTDB URL from
`GCLOUD_PROJECT`; use the explicit value whenever a project uses a non-default
database instance.

Production web builds must set `VITE_USE_FIREBASE_EMULATORS=false`,
`VITE_SERVER_AUTHORITY_ENABLED=true`, and `VITE_FUNCTIONS_REGION=asia-south1`
after the corresponding Functions have been deployed and staging checks pass.

## Testing

Current automated coverage includes:

- game-logic unit tests
- shallow rendering tests for the board
- shallow rendering tests for the dice tray, bot auto-roll trigger path, queued-roll AI selection, and team-mode bot proxy ownership
- reducer-level AFK reclaim, AFK escalation, turn-timer, and terminal victory-state tests
- Temple Coin unit tests for daily idempotency, daily/weekly goal progress, explicit goal claims, idempotent ad multipliers, ads-disabled 200-coin entry, 10% pool fees, winner/loser settlement, human-only public 2v2 team splits with bot-filled seats, and draw refunds
- Playwright browser tests for desktop and compact layouts, local game startup, duplicate piece designs with unique seat colors, private-game navigation, victory UI, player-name overflow, daily/goal rewards, optional ad multiplier behavior, and public-match coin gating

The test suite is passing, but coverage is still relatively light compared to the complexity of the reducer, multiplayer sync, and UI-driven game flow.

## Known Gaps

- Full production server-authority rollout is not complete yet. Game, lobby, lifecycle, wallet, economy, completion, and leaderboard callable paths are implemented behind `VITE_SERVER_AUTHORITY_ENABLED`. Local Functions/emulator and direct authenticated roll acceptance pass; deployed two-browser lobby, game initialization, roll, queue convergence, movement/turn transition, timer progression, online player-label behavior, and compact viewport audits now pass against `onlinedyut`. Roll results dispatch as soon as the visual roll completes, and board movement uses short per-step visual timing so server reconciliation does not add an avoidable UI pause. Reconnect staging checks, rewarded-ad proof, concurrency testing, scheduled leaderboard projections, and the final production-project rollout remain. Offline profile counters stay client-owned and are excluded from verified online rankings.
- The full emulator gate requires the Firebase CLI and a Java 17+ runtime on the development/CI host. The current host can run the CLI after redirecting its config store, but Java 17 is not installed; CI installs Java 17 and runs the authority gate.
- CrazyGames platform leaderboard submission remains separate from website leaderboard projection and still requires the platform capability/secret configuration
- The server-authority economy callables are implemented but remain opt-in until emulator/staging gates pass. With the flag disabled, signed-in standalone balances use the existing Firestore adapter, anonymous balances use local storage, and CrazyGames balances use the Data module. Keep coins as non-purchasable soft currency until the authoritative Functions path and rules are deployed and verified.
- The README was originally minimal and some internal planning docs are more up to date than public-facing docs
- Some complex rule behavior is distributed across reducer, logic helpers, and UI flow rather than fully centralized in one engine module

## License

See [LICENSE](./LICENSE).

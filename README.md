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
- Temple Coin economy with a manually claimed 500-coin UTC daily reward, visible daily/weekly online-play goals with explicit claims, and an optional ad-based reward multiplier. Public Online Match uses a 200-coin entry while ads are disabled (500 when `VITE_CG_ENABLE_ADS=true`), a 10% match fee, and idempotent prize settlement. 1v1/FFA award the remaining pool to one winner, while public 2v2 divides 90% of the paid human-entry pool equally among winning human teammates. Bots neither pay an entry nor receive a prize share. Offline play, Play with Friends, and CrazyGames Instant Multiplayer remain free
- Four selectable piece designs carried in match snapshots independently from seat color; players may choose the same design while unique seat colors preserve player identity
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
- [economy.js](./economy.js): integer-only wallet, daily/weekly goal progress, claim, multiplier, entry, pool, fee, payout, draw-refund, and idempotency rules
- [economyService.js](./economyService.js): standalone, anonymous/local, and CrazyGames economy persistence adapters
- [EconomyContext.jsx](./EconomyContext.jsx): wallet loading, manual daily/goal reward claims, optional ad multipliers, and app-wide balance/settlement state
- [pieceSkins.js](./pieceSkins.js): safe piece-design catalog, default fallback, and stable design identifiers

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

The project expects Firebase environment variables, including:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_DATABASE_URL`

There is also CrazyGames-specific behavior gated by `VITE_CRAZYGAMES_BUILD`.
`VITE_CG_ENABLE_ADS` gates ad behavior; the Basic Launch portal build keeps this set to `false`.
`VITE_ADS_PROVIDER` selects `crazygames`, `google`, `none`, or `auto` (the default, which chooses CrazyGames for portal builds and Google H5 Games Ads for standalone builds). Portal builds always resolve to the CrazyGames SDK provider for platform compliance. Google standalone builds use publisher ID `ca-pub-8676646466866124` by default; `VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-...` can override it for another deployment.
The game uses rewarded ads only: banners and midgame interstitials are not requested. When ads are disabled, the rewarded-ad placeholder and multiplier offer are hidden, and paid public matches use the 200-coin entry amount. Enabling the existing `VITE_CG_ENABLE_ADS=true` flag shows the post-claim reward popup; the player receives the base reward first and can receive one idempotent 2x bonus only after the rewarded ad completes. Local QA can simulate the ad with `VITE_CG_ENABLE_ADS=true` and `?qa=economy-ads`.

Gameplay timing can be tuned with positive whole-number millisecond values:

- `VITE_ONLINE_TURN_TIMEOUT_MS` controls online turn duration, default `30000`
- `VITE_LOCAL_TURN_TIMEOUT_MS` controls local/offline turn duration, default `60000`
- `VITE_TURN_TIMER_WARNING_MS` controls the warning threshold, default `10000`
- `VITE_AFK_BOT_TAKEOVER_STRIKES` controls AFK strikes before bot takeover, default `6`

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

- Server-authoritative move validation is not implemented yet; multiplayer currently relies on client logic plus host coordination
- Economy mutations are isolated behind a transactional adapter, but they are not yet backed by trusted Cloud Functions. Signed-in standalone balances use Firestore transactions, anonymous balances use local storage, and CrazyGames balances use the Data module. Treat the current coins as non-purchasable soft currency until server-authoritative identity, match validation, and ledger settlement are deployed.
- The README was originally minimal and some internal planning docs are more up to date than public-facing docs
- Some complex rule behavior is distributed across reducer, logic helpers, and UI flow rather than fully centralized in one engine module

## License

See [LICENSE](./LICENSE).

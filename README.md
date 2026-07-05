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
- Single-player bot support with heuristic AI
- Firebase authentication, player profiles, and online multiplayer sync
- Public/private lobby flows, host migration, true per-turn countdowns on desktop and mobile, 60-second local turns, 30-second online turns, timer refresh on dice roll, AFK handling with visible strike warnings, reliable auto-roll handoff for bot/AFK-controlled turns, bot takeover for disconnected online players with player reclaim on return, and signed-in account-backed resume for resumable private online matches across devices
- Mobile and desktop play both support rolling directly from the dice panel, keeping manual play and bot/AFK auto-roll on the same interaction path
- Tutorial, rules, history, and about screens
- English, Hindi, and Marathi localization
- CrazyGames portal integration hooks, including first-time-account onboarding that drops signed-in new portal players straight into a local bot match

Resume behavior is intentionally split by mode:

- Offline/local games resume only on the same device using local storage
- Starting a new offline/local match clears the previous local resume snapshot; only explicit resume uses the saved local state
- Resumable private online matches store their reconnect target on the signed-in Firebase account so the same player can reconnect from another device
- The resume prompt appears from the main menu before entering local or online setup, avoiding late prompts after an online lobby has already started; dismissing that prompt keeps the player on the menu

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
- [agents.md](./agents.md): high-level AI assistant context for the project
- [webPortalPlan.md](./webPortalPlan.md): web portal packaging/integration notes

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

There is also portal-specific behavior gated by `VITE_IS_PORTAL`.
CrazyGames ad calls are gated separately by `VITE_CG_ENABLE_ADS`; the Basic Launch portal build keeps this set to `false`.

## Testing

Current automated coverage includes:

- game-logic unit tests
- shallow rendering tests for the board
- shallow rendering tests for the dice tray and bot auto-roll trigger path
- reducer-level AFK reclaim, AFK escalation, turn-timer, and terminal victory-state tests

The test suite is passing, but coverage is still relatively light compared to the complexity of the reducer, multiplayer sync, and UI-driven game flow.

## Known Gaps

- Server-authoritative move validation is not implemented yet; multiplayer currently relies on client logic plus host coordination
- The README was originally minimal and some internal planning docs are more up to date than public-facing docs
- Some complex rule behavior is distributed across reducer, logic helpers, and UI flow rather than fully centralized in one engine module

## License

See [LICENSE](./LICENSE).

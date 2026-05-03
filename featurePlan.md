# Dyut Board Game: Detailed Feature Implementation Plan

## Phase 1: Project Scaffolding and Architecture (Completed)
* Initialize Application: Scaffold a new React application using Vite and configure Tailwind CSS for styling.
* State Management Setup: Initialize a global state using React's useReducer (or Redux Toolkit) to handle the complexity of the game rules.
* Define Core State Types: Set up state objects for the Game (current turn, turn queue), Players (pieces, color, kill flag), and Pieces (status and position).

## Phase 2: Board Generation and Rendering (Completed)
* Data Structure for the Board: Create a linear path array or coordinate map mapping the logical path indices to a 3x8 visual arm grid.
* Render the Grid: Use CSS Grid to position four Arm components and a Center component into a cross.
* Highlight Special Zones & Render Pieces: Implement visual markers for safe zones and the center goal, and map Piece components to the corresponding board cells based on global state.

## Phase 3: The Dice Engine (Completed)
* Custom Roll Logic: Implement logic to randomly generate numbers restricted to 1, 3, 4, and 6.
* Streak and Queue Management: Create a turn queue array and require players to roll again if they roll doubles.
* The Void Rule: Add logic that wipes the queue and ends the turn instantly if exactly a 1 and a 3 combination is rolled.

## Phase 4: Movement and Pathing Logic (Completed)
* Deployment: Allow a piece to spawn from the locked state to indices 2, 6, 8, or 12 using a double roll.
* Movement Priority Engine: Enforce the "Max Value Rule" where players prioritize moving the sum, then the higher die, and finally the lower die.
* Path Calculation: Use helper functions to calculate target indices, update positions, and remove used moves from the queue.

## Phase 5: Combat, Safe Zones, and Blockades (Completed)
* Occupancy Limit & Safe Zones: Limit squares to 2 pieces and establish safe zones where the first occupant blocks it.
* The Pair Shield: Require an attacker to use a special double split-roll to capture two pieces of the same color occupying a single square.
* Capture Logic: Implement standard captures sending opponent pieces to the locked state, and apply the Assassin Rule allowing newly spawning pieces to capture opponents on specific safe zones.

## Phase 6: End Game and Win Conditions (Completed)
* The Blood Debt Check: Prevent players from entering the center path unless they have captured at least one opponent.
* Home Stretch: Disable combat interactions for pieces in the final stretch.
* Victory Pathing: Require all 4 pieces to reach the exact center (index 999), forcing remainder dice values to be used elsewhere.
* Victory Screen: Halt the game and display winning UI when a player finishes.

## Phase 7: Redesign Foundation & Theming (Completed)
* Tailwind Configuration: Update the palette with charcoal backgrounds, velvet red paths, and polished gold.
* Typography & Effects: Add modern typography and custom glassmorphism utilities.

## Phase 8: Unified Pre-Game Lobby (Completed)
* Unified Overlay: Create a single translucent panel over a blurred board.
* Streamlined Setup: Consolidate the player count selector, color picker, and Void Roll toggle into one interaction.
* Action Consolidation: Place "Start" and "Resume" buttons prominently at the bottom.

## Phase 9: Board & Piece Aesthetic Upgrade (Completed)
* The Board: Apply velvet textures and glowing golden-orange safe zone markers.
* The Pieces: Upgrade flat pieces to rich, 3D jewel-like tokens.

## Phase 10: In-Game UI & Player Console Consolidation (Completed)
* Player Control Console: Replace side menus with a minimalist console containing glassmorphic dice and a glowing roll button.
* Thematic Indicators: Use avatars and icon-based stats instead of text.
* Action Menu: Move secondary options to a stylized top-right menu.

## Phase 11: Mobile & Tablet Responsive Layouts (Completed)
* Mobile Layout: Stack the active player's info next to the roll button in a bottom dashboard.
* Tablet Layout: Place all 4 player dashboards vertically on the left.

## Phase 12: Game Play Issue Fix (Completed)
* Movement Fix: Ensure overshoot is not allowed when finishing.
* Queue Fix: Enforce that all rolls must be completed before a piece can be moved.

## Phase 12.5: UI/UX Polish & Accessibility (Completed)
* Color Contrast: Upgraded piece colors to luminous jewel tones (`ruby`, `sapphire`, `emerald`, `amber`) for clear visibility against the velvet board and copper safe zones.
* Visual Anchors: Added internal white circles to pieces for immediate visual recognition.
* Turn Indicators: Highlighted the active player's base with a golden glow, scaling effect, and bright white typography.
* Stuck State Feedback: Implemented a transient, glassmorphic toast notification over the dice tray when a player is skipped due to no valid moves.
* Stale State Fix: Forced `selectedPiece` and `pairAttackState` to clear automatically upon turn transitions to prevent cross-turn UI bleed.
* Theme Cohesion: Unified all remaining modals (Move Selector, Void Roll, Victory) to use the core `charcoal`, `gold`, and `ruby` glassmorphic design system.

## Phase 12.6: Gameplay Bug Fixes (Completed)
* Pair Shield vs. Assassin Override: Fixed an issue where a spawning piece instantly kills an opponent's Pair Shield. The Pair Shield rule strictly requires a coordinated two-piece Pair Attack to be broken, overriding the Assassin spawn capture.
* Mobile Piece Highlight Fix: Adjusted the highlighted pieces in mobile view so the pulse/ring effect doesn't get clipped or look wonky due to overflowing outside the square container.

---

## Phase 13: Rule-Based AI Bot (Single-Player Mode) (Completed)
* Objective: Build a heuristic algorithm that uses the existing logic to play against humans without server costs.
* Evaluation Function: Create a utility to score board states, prioritizing kills, safe zones, and the "Home Stretch".
* Evaluation Modifiers: Apply medium priority for forming pair shields and negative priority for leaving safe zones.
* Difficulty Levels: Implement an easy mode that picks random valid moves, and a hard mode that uses optimal heuristic scoring.
* Architecture: Create an `aiLogic.js` layer that listens to the `GameContext`.
* Execution: Automatically trigger dice rolls for the AI, pass values to the logic layer, and add a 1-2 second timeout to simulate thinking.

## Phase 14: Multi-Language Support (i18n) (Completed)
* Technology Stack: Install the `i18next` and `react-i18next` libraries.
* Configuration: Set up an `i18n.js` config file alongside the Vite entry point.
* Translation Files: Create `en.json`, `hi.json`, and `mr.json` dictionaries storing key-value pairs for UI elements.
* Implementation: Wrap main UI strings in the `useTranslation` hook.
* User Controls: Add a glassmorphic dropdown menu to trigger language changes.

## Phase 15: Android App Packaging (Pending)
* Preparation: Install the Capacitor core, Android packages, and CLI locally.
* Initialization: Run `npx cap init` to define the app name and ID.
* Configuration: Map the `webDir` to Vite's build output folder (`dist`) inside `capacitor.config.json`.
* Build & Sync: Build the React application and sync the assets to the Android folder.
* Deployment: Configure app icons and splash screens in Android Studio for emulator testing.

## Phase 16: Offline Local Multiplayer (Pending)
* Technology Stack: Utilize WebRTC and the Capacitor Community Bluetooth LE Plugin.
* Device Discovery: Use the Bluetooth plugin to advertise a host and scan for guests.
* Signaling: Transmit WebRTC SDP tokens over Bluetooth to open a Data Channel.
* State Syncing: Dispatch all `GameContext` actions as stringified JSON payloads across WebRTC to synchronize both screens perfectly.

## Phase 17.1: Firebase Setup & Authentication (Completed)
* Technology Stack: Utilize Firebase Firestore for NoSQL document storage and Firebase Anonymous Authentication to handle persistent reconnects.
* State Architecture: Sync React `Context` with Firestore `onSnapshot` listeners.
* Data Schema: Store the game session as one JSON-like document in a `games` collection.
* Project Configuration: Set up a free Firebase project, install the SDK, and initialize it inside a `services/firebase.js` file.
* Authentication Init & URL Parsing: Call `signInUserAnonymously()` on app load to assign users a persistent silent `uid`. Read `?join=GAME_ID` from the URL to route joining players automatically.

## Phase 17.2: Collaborative Lobby Syncing (Completed)
* Collaborative Lobby Syncing: Push the 2x2 "Seat Arrangement" to Firestore so joining players can see the host's setup in real-time, "Claim" specific seats, and bind their `uid` to a player slot.

## Phase 17.3: Real-Time Synchronization Engine (Completed)
* Real-Time Synchronization: Set up a `useEffect` hook in `GameContext.jsx` to listen for document updates via `onSnapshot` and dispatch a `SYNC_FROM_CLOUD` action to update the UI.
* The Action Interceptor (Middleware): Wrap the `dispatch` function to intercept actions, calculate the new state locally, and push delta updates to Firestore using `updateDoc()`.

## Phase 17.4: Firestore Cost Optimization & Bot Handling (Completed)
* Cost Minimization (Read/Write Batching): Combine Roll & Auto-Move and Bot turns into single `updateDoc()` calls to drastically reduce Firestore usage and stay within the free tier.
* Host-Only Bot Execution: Restrict the `useAIBot` hook so only the "Host" calculates and pushes bot moves, preventing multiple connected clients from writing simultaneously.

## Phase 18: Persistent Authentication & Player Profiles (Completed)
* Technology Stack: Implemented Firebase Authentication (Google Auth Provider) and Firestore (for user stats).
* Account Upgrades: Allowed users to link their Firebase Anonymous Auth session to a Google account, preserving their identity.
* Cross-Device Profiles: Created a `users` collection in Firestore to securely store persistent player profiles, tracking global stats like wins and games played.
* UI Integration: Added an interactive `PlayerProfile` glassmorphic component to the `UnifiedLobby` overlay to trigger the authentication flow, display player stats, and edit display names.
* Data Merging: Implemented robust `mergeUserStats` logic. If an anonymous user signs into an existing Google account, their offline progress is cleanly merged into their cloud profile before the anonymous ghost document is deleted.

## Phase 19: Interactive Tutorial Overlay (Pending)
* Custom Animated Tutorial: Implement a first-time user experience (FTUE) overlay for new players.
* Highlight Safe Zones: Use targeted spotlights or SVG masks to visually emphasize the golden 'X' safe zones and explain their mechanics.
* Pair Shield Explanation: Add an animated sequence or interactive step demonstrating how two pieces of the same color form a Pair Shield and how it can only be broken by a coordinated Pair Attack.

## Phase 20: Advanced Blockade Breaching (Completed)
* Synchronized Dual Spawn Attack: Implemented logic to allow a player to break an enemy Pair Shield on the 8th or 12th square by simultaneously spawning two pieces. This requires the player to have at least two identical valid rolls (e.g., two `4`s) in their queue and two locked pieces.
* Dual Spawn UI & Action: Added a `DUAL_SPAWN_ATTACK` action to the global state and updated `Board.jsx`/`MoveSelector.jsx` to present this explosive option when the exact conditions are met.
* Combat Engine Update: Modified `applyCombat` to properly process the simultaneous removal of the enemy pair and the placement of the two newly spawned attacking pieces.
* Active Pair Attack Refinement: Ensured standard Pair Attacks (using a double roll to move an existing pair) strictly validate that the path for *both* pieces is completely clear of other blockades before allowing them to strike an enemy blockade.

## Phase 21: Lighthouse, Accessibility, and SEO Improvements (Completed)
* Accessibility (Landmarks): Converted the root layout wrapper in `App.jsx` from a `<div>` to a `<main>` tag to satisfy HTML5 landmark requirements for screen readers.
* Accessibility (Contrast): Upgraded the opacity of the "Empty" queue text in the Dice Tray from 30% to 60% (`text-white/60`) to meet the minimum 4.5:1 contrast ratio.
* SEO (Robots Directive): Created a standard `robots.txt` file in the `public/` directory to prevent Vite SPA routing from serving HTML to crawlers requesting standard txt directives.
* SEO (Meta Data): Added a comprehensive `<meta name="description">` tag to `index.html` to improve search engine result snippets.
* Performance (Audit Validation): Validated that "Unminified JavaScript" and "Unused JavaScript" penalties in Lighthouse are artifacts of the local Vite dev server and will be resolved by running a production build with proper Firebase v9 modular tree-shaking.


## Suggested State Architecture Example
```javascript
const initialState = {
  currentPlayer: 'Player1',
  turnQueue: [], // e.g., [{ d1: 4, d2: 4, sum: 8 }]
  players: {
    Player1: { color: 'red', hasKilled: false, pieces: [-1, -1, -1, -1] }, // -1 is locked
    Player2: { color: 'green', hasKilled: false, pieces: [-1, -1, -1, -1] },
    Player3: { color: 'yellow', hasKilled: false, pieces: [-1, -1, -1, -1] },
    Player4: { color: 'black', hasKilled: false, pieces: [-1, -1, -1, -1] }
  },
  boardOccupancy: {} // Maps path indices to piece IDs to quickly check collisions/blockades
};

const actionTypes = {
  ROLL_DICE: 'ROLL_DICE',
  SPAWN_PIECE: 'SPAWN_PIECE',
  MOVE_PIECE: 'MOVE_PIECE',
  END_TURN: 'END_TURN'
};
```
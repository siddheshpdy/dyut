# Dyut Game Feature Implementation Plan

## Phase 1: Project Scaffolding and Architecture
**Status: Completed**
**Objective:** Set up the foundational technologies and define the global state structure.
1. **Initialize Application:** Scaffold a new React application using Vite and configure Tailwind CSS for styling.
2. **State Management Setup:** Given the complexity of the game rules (queues, streaks, multiple piece states), initialize a global state using React's `useReducer` (or Redux Toolkit).
3. **Define Core State Types:**
   * **Game State:** Current turn, `turnQueue` (array of roll objects e.g., `[{d1: 4, d2: 4, sum: 8}]`), turn history.
   * **Player State:** Object tracking 4 players. Each needs: `pieces` (array of 4 positions, starting at -1), `color`, and a global `hasKilled` (boolean for the whole team).
   * **Piece State:** ID, status (`LOCKED`, `ON_BOARD`, `HOME_STRETCH`, `FINISHED`), current position (path index or -1).

## Phase 2: Board Generation and Rendering
**Status: Completed**
**Objective:** Visually construct the 4-arm cross using CSS Grid and Tailwind, mapping out the coordinate system.
1. **Data Structure for the Board:** Create a coordinate map or a linear path array (0 to N) that represents the universal track. Map the specific visual grid (3x8 arms) to these logical path indices.
2. **Render the Grid:** Implement a `Board` component containing four `Arm` components and a `Center` component. Use CSS Grid to position them into a cross.
3. **Highlight Special Zones:** Implement visual markers (like an 'X') for safe zones (indices 6, 8, 12) and the center goal (`char-koni`).
4. **Render Pieces:** Create a `Piece` component that reads its position from the global state and overlays onto the corresponding board cell.

## Phase 3: The Dice Engine
**Status: Completed**
**Objective:** Build the custom dice roller and turn-queueing system.
1. **Custom Roll Logic:** Implement a function that randomly generates numbers from the specific set `[1, 3, 4, 6]`.
2. **Streak and Queue Management:**
   * Create a state array for `turnQueue` containing the roll details (e.g., `[{d1: 4, d2: 6, sum: 10}]`).
   * **Doubles Streak:** If `die1 === die2`, queue the roll and the player MUST roll again until `die1 !== die2`. All queued moves are played in one turn.
3. **The Void Rule:** Add logic that clears the `turnQueue` entirely and ends the turn immediately if EXACTLY a `1` and `3` (or `3` and `1`) combination is rolled.

## Phase 4: Movement and Pathing Logic
**Status: Completed**
**Objective:** Move pieces along the board using the queued dice rolls.
1. **Deployment (Spawning):** Implement the logic allowing a piece to transition from locked (-1) to on-board. They require a double to spawn, landing directly on path indices mapping to 2, 6, 8, or 12.
2. **Movement Priority Engine (CRITICAL):** When calculating `getValidMoves()`, you must enforce the "Max Value Rule" where a player cannot choose a smaller move if a larger valid move exists:
   * **Priority 1:** Move the `Sum` of the dice.
   * **Priority 2:** If the Sum is blocked, move the `Higher Die`.
   * **Priority 3:** If the Higher Die is blocked, move the `Lower Die`.
3. **Path Calculation & Using Rolls:** Create a helper function that takes a piece's current index and a die value to calculate the target index. Update the piece's position and remove the used move from the `turnQueue`.

## Phase 5: Combat, Safe Zones, and Blockades
**Status: In Progress**
**Objective:** Implement the collision mechanics when pieces land on the same square.
1. **Occupancy Limit & Safe Zones ('X'):** A square can hold a max of 2 pieces. Indices 6, 8, 12, and the 1st-column-cross on any arm are safe zones. First player to land on an 'X' blocks it.
2. **The Pair Shield:** If a square has 2 pieces of the SAME color, they form a Pair. A Pair can ONLY be killed if the attacker uses a "Special Roll" (doubles) and splits movement to land exactly 2 attacking pieces on that square simultaneously.
3. **Standard Kill:** If a piece lands on an occupied standard square (not a pair), send the opponent's piece back to locked (-1) status and toggle the attacking player's `hasKilled` flag to `true`.
4. **The Assassin (Breach Rule):** Traveling pieces CANNOT kill an opponent on an 'X' safe zone. Exception: A newly spawning piece CAN kill an opponent on an 'X' zone (spots 8 or 12) if they spawn using a double 4s (8) or double 6s (12).

## Phase 6: End Game and Win Conditions
**Status: Completed**
**Objective:** Implement the final stretch rules and victory detection.
1. **The Blood Debt Check:** Prevent a piece from turning into the `HOME_STRETCH` (middle column) unless its player's `hasKilled` flag is `true`.
2. **Home Stretch Immunity:** Disable combat interactions for pieces currently in the `HOME_STRETCH` status.
3. **Victory Pathing (Overshoot & Remainder):** All 4 pieces must reach the center. 
   * *Overshoot:* A piece 2 squares away can use a 3 or 4 to win. 
   * *Mandatory Remainder:* If partial dice value is used to win, the remaining dice value MUST be applied to another piece on the board if a valid move exists.
4. **Victory Screen:** When a player's 4 pieces reach `FINISHED`, halt the game and display the winning UI.

## Phase 7: Redesign Foundation & Theming
**Status: Completed**
**Objective:** Establish the new aesthetic base, updating colors, textures, and core visual utilities.
1. **Tailwind Configuration:** Update the color palette with rich charcoal backgrounds, crimson velvet board paths, polished gold, and jewel tones (Ruby, Sapphire, Emerald, Amber).
2. **Typography & Effects:** Implement modern typography and add global CSS utilities for glassmorphism (backdrop blurs, subtle borders) and glowing effects.

## Phase 8: Unified Pre-Game Lobby
**Status: Completed**
**Objective:** Consolidate the fragmented setup screens into a single elegant flow.
1. **Unified Overlay:** Create a single translucent glassmorphic panel that sits over a deeply blurred game board.
2. **Streamlined Setup:** Combine the player count selector (horizontal list) with the color picker (showing 3D jewel tokens) and the Void Roll toggle into one seamless interaction.
3. **Action Consolidation:** Place the "Start New Game" and "Resume Last Session" buttons prominently at the bottom of this unified panel.

## Phase 9: Board & Piece Aesthetic Upgrade
**Status: Completed**
**Objective:** Elevate the board and game pieces to high-fidelity 3D/textured assets.
1. **The Board:** Apply crimson velvet textures and polished gold text to the board. Redesign the Safe Zone ('X') markers into glowing golden-orange geometric symbols.
2. **The Pieces:** Upgrade the `Piece` component from flat circles to rich, 3D jewel-like tokens with soft directional shadows to mimic physical depth.

## Phase 10: In-Game UI & Player Console Consolidation
**Status: Completed**
**Objective:** Replace utilitarian menus with a sleek, thematic control interface.
1. **Player Control Console:** Remove the detached side menus. Create a minimalist console adjacent to the board featuring glassmorphic dice and a large, pulsing, glowing "ROLL" button.
2. **Thematic Indicators:** Replace text-based kill counts and player names with elegant avatars and icon-based stats (e.g., crossed swords for kills).
3. **Top-Right Action Menu:** Move secondary actions (Rules, Reset, New Game) into a subtle, stylized "Scroll and Gear" icon menu in the top right corner to maximize board visibility.

## Phase 11: Mobile & Tablet Responsive Layouts
**Status: Completed**
**Objective:** Tailor the consolidated UI specifically for smaller screens.
1. **Mobile Layout (Vertical):** Implement a "Contextual Bottom Dashboard" that stacks the active player's info directly next to the dice and roll button within the thumb zone.
2. **Tablet Layout (Landscape):** Utilize the extra width by placing all 4 player dashboards vertically on the left, keeping the main Player Control Console on the right.

## Phase 12: Game play issue fix
**Status: Completed**
**Objective:** fixing particular issues.
1. ~~overshoot not to be allowed when finishing, for finish value should be exact value of 1 of the dice.~~ (Completed)
2. ~~till all tolls are not complete user should not be able to move any piece. its currently happening and it can break game. eg what happening is if user rolls special roll he can directly enter piece even tho roll dice button is active. and if user moves piece then queue gets empty and next players chance begins.~~ (Completed)




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
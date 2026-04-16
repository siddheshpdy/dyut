# UPDATE SYSTEM CONTEXT: "Dyut" Game Logic & Rules Architecture

You are assisting in building a digital version of the traditional Indian board game "Dyut". 
Tech Stack: React, Vite, Tailwind CSS.

Please update your internal logic model for the game engine based on the following complete and finalized rule set. All previous conflicting rules are overridden by this document.

## 1. Game State Structure Requirements
The game engine must track:
- `diceFaces`: [1, 3, 4, 6] (Strictly these values, no 2 or 5).
- `turnQueue`: Array of active rolls (e.g., `[{d1: 4, d2: 4, sum: 8}, {d1: 1, d2: 4, sum: 5}]`).
- `players`: Object tracking 4 players. Each needs: `pieces` (array of 4 positions), `color`, and a global `hasKilled` (boolean for the whole team).
- `board`: Cross-shaped path. Center is goal. 4 arms of 3x8 grids.

## 2. Dicing & Turn Logic
- **Doubles Streak:** If `die1 === die2`, the roll is queued and the player MUST roll again until `die1 !== die2`. All queued moves are played in one turn.
- **Void Rule (1+3):** If a roll is EXACTLY a 1 and a 3 (or 3 and 1), the `turnQueue` is completely cleared, and the turn ends immediately.

## 3. Movement Priority Engine (CRITICAL)
When calculating `getValidMoves()`, you must enforce the "Max Value Rule". A player cannot choose a smaller move if a larger valid move exists.
- **Priority 1:** Move the `Sum` of the dice.
- **Priority 2:** If the Sum is blocked, move the `Higher Die`.
- **Priority 3:** If the Higher Die is blocked, move the `Lower Die`.
- *Note:* If a roll is [4, 6] and the 10th square is blocked, the player MUST move a piece 6 squares. They cannot choose to move 4 squares instead.

## 4. Combat & Blocking Logic
- **Occupancy Limit:** Max 2 pieces per square.
- **Safe Zones ('X'):** Indices representing 6, 8, 12, and the 1st-column-cross on any arm. First player to land on an 'X' blocks it.
- **The Pair Shield:** If a square has 2 pieces of the SAME color, they form a Pair. 
  - *Kill Condition:* A Pair can ONLY be killed if the attacker uses a "Special Roll" (doubles) and splits the movement to land exactly 2 attacking pieces on that square simultaneously.
- **The Assassin (Breach Rule):** Pieces traveling on the board CANNOT kill an opponent on an 'X' safe zone. 
  - *Exception:* A newly spawning piece (entering the board for the first time) CAN kill an opponent on an 'X' zone (spots 8 or 12) if they spawn using a double 4s (8) or double 6s (12).

## 5. Spawning, Pathing, and Victory
- **Spawning:** Pieces start locked (-1). They require a double to spawn, landing directly on path indices mapping to 2, 6, 8, or 12.
- **Blood Debt:** A piece CANNOT enter its final "home stretch" (middle column returning to center) unless its team's `hasKilled` boolean is `true`. (One kill unlocks the home stretch for all 4 pieces).
- **Winning:** All 4 pieces must reach the center. 
  - *Overshoot:* A piece 2 squares away can use a 3 or 4 to win. 
  - *Mandatory Remainder:* If partial dice value is used to win, the remaining dice value MUST be applied to another piece on the board if a valid move exists.
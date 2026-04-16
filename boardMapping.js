export const ARM_LENGTH = 8;
export const ARM_WIDTH = 3;

// Define the 4 arms logically. Orientation is anti-clockwise.
export const ARMS = {
  0: 'SOUTH', // Player 1 (Yellow)
  1: 'EAST',  // Player 2 (Black)
  2: 'NORTH', // Player 3 (Green)
  3: 'WEST',  // Player 4 (Blue)
};

/**
 * 1. LOGICAL PATH GENERATOR
 * Generates a 1D array representing the exact path a player's piece will take.
 * Path rules: Center -> Down middle -> Anti-clockwise perimeter -> Up middle -> Center
 */
export function generatePlayerPath(armIndex) {
  const path = [];
  
  path.push('CENTER'); // Start
  
  // 1. Down the middle column (outwards from center)
  for (let row = 0; row < ARM_LENGTH; row++) {
    path.push(`arm_${armIndex}_col_1_row_${row}`);
  }

  // 2. Anti-clockwise perimeter traversal
  let currentArm = armIndex;
  for (let i = 0; i < 4; i++) {
    // Go UP the LEFT column (inwards to center)
    for (let row = ARM_LENGTH - 1; row >= 0; row--) {
      path.push(`arm_${currentArm}_col_0_row_${row}`);
    }

    // Move to the next arm anti-clockwise
    currentArm = (currentArm + 1) % 4;

    // Go DOWN the RIGHT column (outwards from center)
    for (let row = 0; row < ARM_LENGTH; row++) {
      path.push(`arm_${currentArm}_col_2_row_${row}`);
    }

    // Cross the tip to the LEFT column (if we aren't at the end of the perimeter)
    if (i < 3) {
      path.push(`arm_${currentArm}_col_1_row_${ARM_LENGTH - 1}`);
    }
  }

  // 3. Up the middle column (Home Stretch)
  // We append "_HOME" to distinguish the final stretch from the starting stretch logically
  for (let row = ARM_LENGTH - 1; row >= 0; row--) {
    path.push(`arm_${armIndex}_col_1_row_${row}_HOME`);
  }

  // 4. Center (Finished)
  path.push(`CENTER_FINISHED_${armIndex}`);

  return path;
}

/**
 * 2. SAFE ZONE DETERMINATION
 * Rules dictate indices 6, 8, 12 and the '1st-column-cross'.
 * By tracing the path, these form a perfectly symmetrical pattern on every arm.
 */
export function isSafeZone(col, row) {
  if (col === 1 && row === 7) return true; // Tip of the arm (Path index 8)
  if (col === 1 && row === 5) return true; // Middle column marker (Path index 6)
  if ((col === 0 || col === 2) && row === 4) return true; // The outer columns 'cross' (Path index 12)
  return false;
}

/**
 * 3. VISUAL GRID GENERATOR
 * Generates all 96 normal cells + 1 center cell to be rendered via CSS Grid.
 * Calculates perfect 19x19 grid coordinates.
 */
export function generateBoardCells() {
  const cells = [];

  // The large central finish zone
  cells.push({
    id: 'CENTER',
    gridRow: '9 / span 3',
    gridColumn: '9 / span 3',
    type: 'CENTER',
    isSafe: true
  });

  // Helper to calculate exact CSS grid lines (1 to 19)
  const getGridCoords = (arm, col, row) => {
    switch(arm) {
      case 0: return { gridCol: 11 - col, gridRow: 12 + row }; // SOUTH
      case 1: return { gridCol: 12 + row, gridRow: 9 + col };  // EAST
      case 2: return { gridCol: 9 + col,  gridRow: 8 - row };  // NORTH
      case 3: return { gridCol: 8 - row,  gridRow: 11 - col }; // WEST
      default: return { gridCol: 1, gridRow: 1 };
    }
  };

  for (let arm = 0; arm < 4; arm++) {
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 8; row++) {
        const { gridCol, gridRow } = getGridCoords(arm, col, row);
        cells.push({
          id: `arm_${arm}_col_${col}_row_${row}`,
          arm, col, row,
          gridRow, gridCol,
          isSafe: isSafeZone(col, row),
          type: col === 1 ? 'MIDDLE' : 'PERIMETER'
        });
      }
    }
  }

  return cells;
}

export const PLAYER_PATHS = {
  Player1: generatePlayerPath(0),
  Player2: generatePlayerPath(1),
  Player3: generatePlayerPath(2),
  Player4: generatePlayerPath(3)
};
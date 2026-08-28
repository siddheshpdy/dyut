export const ARM_LENGTH = 8;
export const ARM_WIDTH = 3;

export const ARMS = {
  0: 'SOUTH',
  1: 'EAST',
  2: 'NORTH',
  3: 'WEST',
};

export function generatePlayerPath(armIndex) {
  const path = ['CENTER'];

  for (let row = 0; row < ARM_LENGTH; row += 1) {
    path.push(`arm_${armIndex}_col_1_row_${row}`);
  }

  let currentArm = armIndex;
  for (let i = 0; i < 4; i += 1) {
    for (let row = ARM_LENGTH - 1; row >= 0; row -= 1) {
      path.push(`arm_${currentArm}_col_0_row_${row}`);
    }
    currentArm = (currentArm + 1) % 4;
    for (let row = 0; row < ARM_LENGTH; row += 1) {
      path.push(`arm_${currentArm}_col_2_row_${row}`);
    }
    if (i < 3) path.push(`arm_${currentArm}_col_1_row_${ARM_LENGTH - 1}`);
  }

  for (let row = ARM_LENGTH - 1; row >= 0; row -= 1) {
    path.push(`arm_${armIndex}_col_1_row_${row}_HOME`);
  }
  path.push(`CENTER_FINISHED_${armIndex}`);
  return path;
}

export function isSafeZone(col, row) {
  return (col === 1 && (row === 7 || row === 5)) || ((col === 0 || col === 2) && row === 4);
}

export const PLAYER_PATHS = {
  Player1: generatePlayerPath(0),
  Player2: generatePlayerPath(1),
  Player3: generatePlayerPath(2),
  Player4: generatePlayerPath(3),
};

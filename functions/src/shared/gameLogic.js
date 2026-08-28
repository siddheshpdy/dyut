import { PLAYER_PATHS, isSafeZone as isCellVisuallySafe } from './boardMapping.js';

export function getProxyPlayerId(playerId, state) {
  if (!state?.isTeamMode) return playerId;
  const player = state.players?.[playerId];
  if (!player || !player.pieces.every((piece) => piece === 999)) return playerId;
  const teammateId = Object.keys(state.players).find((id) => id !== playerId && state.players[id].team === player.team);
  return teammateId && !state.players[teammateId].pieces.every((piece) => piece === 999) ? teammateId : playerId;
}

export function getOccupantsOfPathIndex(targetPathIndex, checkingPlayerId, allPlayersState) {
  if (targetPathIndex < 0) return [];
  const targetCellId = PLAYER_PATHS[checkingPlayerId]?.[targetPathIndex];
  if (!targetCellId || targetCellId.startsWith('CENTER')) return [];
  const targetVisualId = targetCellId.replace('_HOME', '');
  const occupants = [];
  for (const [playerId, player] of Object.entries(allPlayersState || {})) {
    for (const [pieceIndex, piecePos] of player.pieces.entries()) {
      const occupantCellId = piecePos !== -1 && piecePos !== 999 ? PLAYER_PATHS[playerId]?.[piecePos] : null;
      if (occupantCellId && occupantCellId.replace('_HOME', '') === targetVisualId) occupants.push({ playerId, pieceIndex });
    }
  }
  return occupants;
}

export function getPairShieldTarget(targetPathIndex, movingPlayerId, state) {
  const occupants = getOccupantsOfPathIndex(targetPathIndex, movingPlayerId, state.players);
  if (occupants.length !== 2) return null;
  const sameTeam = state.isTeamMode
    ? state.players[occupants[0].playerId].team === state.players[occupants[1].playerId].team
    : occupants[0].playerId === occupants[1].playerId;
  const isEnemy = state.isTeamMode
    ? state.players[occupants[0].playerId].team !== state.players[movingPlayerId].team
    : occupants[0].playerId !== movingPlayerId;
  return sameTeam && isEnemy ? occupants[0].playerId : null;
}

function isSquareBlocked(targetPathIndex, movingPlayerId, state) {
  const path = PLAYER_PATHS[movingPlayerId];
  if (targetPathIndex >= path.length) return true;
  const targetCellId = path[targetPathIndex];
  if (targetCellId && (targetCellId.includes('_HOME') || targetCellId.includes('CENTER_FINISHED')) && !state.players[movingPlayerId].hasKilled) return true;
  const occupants = getOccupantsOfPathIndex(targetPathIndex, movingPlayerId, state.players);
  const isEnemy = (id) => state.isTeamMode ? state.players[id].team !== state.players[movingPlayerId].team : id !== movingPlayerId;
  const isSameTeam = (id1, id2) => state.isTeamMode ? state.players[id1].team === state.players[id2].team : id1 === id2;
  if (occupants.length === 2 && isSameTeam(occupants[0].playerId, occupants[1].playerId) && isEnemy(occupants[0].playerId)) return true;
  if (occupants.length >= 2) return true;
  if (occupants.length === 1 && isEnemy(occupants[0].playerId)) {
    const parts = targetCellId.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
    if (parts && isCellVisuallySafe(Number(parts[2]), Number(parts[3]))) return true;
  }
  return false;
}

export function getValidMoves(pieceCurrentPos, roll, playerId, state) {
  const high = Math.max(roll.d1, roll.d2);
  const low = Math.min(roll.d1, roll.d2);
  if (roll.d2 == null) {
    const valid = !isSquareBlocked(pieceCurrentPos + roll.d1, playerId, state);
    return { sum: valid, high: valid, low: valid };
  }
  return {
    sum: !isSquareBlocked(pieceCurrentPos + roll.sum, playerId, state),
    high: !isSquareBlocked(pieceCurrentPos + high, playerId, state),
    low: !isSquareBlocked(pieceCurrentPos + low, playerId, state),
  };
}

export function canSpawnPiece(playerId, spawnPos, state) {
  const targetCellId = PLAYER_PATHS[playerId]?.[spawnPos];
  const occupants = getOccupantsOfPathIndex(spawnPos, playerId, state.players);
  const isFriendly = (id) => state.isTeamMode ? state.players[id].team === state.players[playerId].team : id === playerId;
  const friendlyPieces = occupants.filter((o) => isFriendly(o.playerId));
  if (friendlyPieces.length >= 2) return false;
  const enemyPieces = occupants.filter((o) => !isFriendly(o.playerId));
  if (enemyPieces.length > 0) {
    if (enemyPieces.length === 2) {
      const proxyId = getProxyPlayerId(playerId, state);
      const lockedCount = state.players[proxyId].pieces.filter((p) => p === -1).length;
      if (lockedCount >= 2 && (spawnPos === 8 || spawnPos === 12)) {
        const doubleRolls = state.turnQueue.filter((roll) => roll.sum === spawnPos && roll.d1 === roll.d2 && roll.d2 !== null);
        if (doubleRolls.length >= 2) return 'DUAL_SPAWN';
      }
      return false;
    }
    const parts = targetCellId?.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
    const isTargetSafe = parts && isCellVisuallySafe(Number(parts[2]), Number(parts[3]));
    if (isTargetSafe && spawnPos !== 8 && spawnPos !== 12) return false;
  }
  return true;
}

export function hasAnyPlayableMove(originalPlayerId, state) {
  if (state.isTutorial) return true;
  const playerId = getProxyPlayerId(originalPlayerId, state);
  const player = state.players?.[playerId];
  if (!player || !state.turnQueue?.length) return false;

  for (const roll of state.turnQueue) {
    if (roll.d1 === roll.d2 && roll.d2 != null && player.pieces.some((piece) => piece === -1) && canSpawnPiece(playerId, roll.sum, state)) return true;
    for (let pieceIndex = 0; pieceIndex < player.pieces.length; pieceIndex += 1) {
      const position = player.pieces[pieceIndex];
      if (position === -1 || position === 999) continue;
      const valid = getValidMoves(position, roll, playerId, state);
      if (valid.sum || valid.high || valid.low) return true;
      if (roll.d1 === roll.d2 && roll.d2 != null) {
        const targetPosition = position + roll.d1;
        const target = getPairShieldTarget(targetPosition, playerId, state);
        if (target) {
          const targetCell = PLAYER_PATHS[playerId][targetPosition];
          const parts = targetCell?.match(/arm_(\d+)_col_(\d+)_row_(\d+)/);
          const safe = parts && isCellVisuallySafe(Number(parts[2]), Number(parts[3]));
          const hasPartner = player.pieces.some((otherPosition, otherIndex) => otherIndex !== pieceIndex && otherPosition !== -1 && otherPosition + roll.d1 === targetPosition);
          if (!safe && hasPartner) return true;
        }
      }
    }
  }
  return false;
}

export function willMoveKill(targetPathIndex, movingPlayerId, state) {
  const targetCellId = PLAYER_PATHS[movingPlayerId]?.[targetPathIndex];
  if (!targetCellId || targetCellId.startsWith('CENTER') || targetCellId.includes('_HOME')) return false;
  const occupants = getOccupantsOfPathIndex(targetPathIndex, movingPlayerId, state.players);
  const isEnemy = (id) => state.isTeamMode ? state.players[id].team !== state.players[movingPlayerId].team : id !== movingPlayerId;
  return occupants.length === 1 && isEnemy(occupants[0].playerId);
}

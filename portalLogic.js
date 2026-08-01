export const INSTANT_MULTIPLAYER_CONFIG = Object.freeze({
  matchType: '1v1',
  isQuickGame: false,
  isVoidRuleEnabled: true,
  botDifficulty: 'easy'
});

export function shouldQueuePortalFirstSession({
  isMounted,
  hasQueuedIntro,
  hasQueuedInstantMultiplayer,
  view,
  joinGameId,
  hasSavedGameState,
  hasSavedPlayerCount,
  hasPortalStats
}) {
  return Boolean(
    isMounted &&
    !hasQueuedIntro &&
    !hasQueuedInstantMultiplayer &&
    view === 'menu' &&
    !joinGameId &&
    !hasSavedGameState &&
    !hasSavedPlayerCount &&
    !hasPortalStats
  );
}

export function createCrazyGamesRoomUpdate(action, seats, roomId) {
  const humanSeats = Object.values(seats).filter((seat) => seat.type === 'human');
  const claimedSeats = humanSeats.filter((seat) => seat.uid);
  const isFull = humanSeats.length > 0 && humanSeats.length === claimedSeats.length;
  const hasStarted = action === 'start' || isFull;

  return {
    roomId,
    action: hasStarted ? 'start' : 'update',
    playerCount: claimedSeats.length,
    maxPlayerCount: humanSeats.length,
    isJoinable: !hasStarted,
    inviteParams: { roomId }
  };
}

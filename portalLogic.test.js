import { describe, expect, it } from 'vitest';
import { INSTANT_MULTIPLAYER_CONFIG, createCrazyGamesRoomUpdate, shouldQueuePortalFirstSession } from './portalLogic.js';

describe('portal first-session routing', () => {
  const readyPortal = {
    isMounted: true,
    hasQueuedIntro: false,
    hasQueuedInstantMultiplayer: false,
    view: 'menu',
    joinGameId: null,
    hasSavedGameState: false,
    hasSavedPlayerCount: false,
    hasPortalStats: false
  };

  it('queues onboarding only for a new portal player at the menu', () => {
    expect(shouldQueuePortalFirstSession(readyPortal)).toBe(true);
    expect(shouldQueuePortalFirstSession({ ...readyPortal, hasPortalStats: true })).toBe(false);
    expect(shouldQueuePortalFirstSession({ ...readyPortal, joinGameId: 'ABCD12' })).toBe(false);
    expect(shouldQueuePortalFirstSession({ ...readyPortal, hasSavedGameState: true })).toBe(false);
  });
});

describe('CrazyGames room state', () => {
  const seats = {
    Player1: { type: 'human', uid: 'host' },
    Player2: { type: 'human', uid: null },
    Player3: { type: 'bot', uid: null },
    Player4: { type: 'closed', uid: null }
  };

  it('reports room capacity and keeps a waiting room joinable', () => {
    expect(createCrazyGamesRoomUpdate('update', seats, 'ROOM01')).toEqual({
      roomId: 'ROOM01',
      action: 'update',
      playerCount: 1,
      maxPlayerCount: 2,
      isJoinable: true,
      inviteParams: { roomId: 'ROOM01' }
    });
  });

  it('locks a room when the match starts or all human seats are claimed', () => {
    expect(createCrazyGamesRoomUpdate('start', seats, 'ROOM01').isJoinable).toBe(false);
    expect(createCrazyGamesRoomUpdate('update', {
      ...seats,
      Player2: { type: 'human', uid: 'guest' }
    }, 'ROOM01')).toMatchObject({ action: 'start', isJoinable: false, playerCount: 2 });
  });
});

describe('Instant Multiplayer', () => {
  it('always uses a free private 1v1 config', () => {
    expect(INSTANT_MULTIPLAYER_CONFIG).toEqual({
      matchType: '1v1',
      isQuickGame: false,
      isVoidRuleEnabled: true,
      botDifficulty: 'easy'
    });
  });
});

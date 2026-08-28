import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('./firebaseSetup.js', () => ({ db: { name: 'test-db' } }));

import { loadWebsiteLeaderboard } from './leaderboardService.js';

describe('website leaderboard service', () => {
  beforeEach(() => {
    Object.values(firestoreMocks).forEach((mock) => mock.mockReset());
    firestoreMocks.collection.mockReturnValue('leaderboard-collection');
    firestoreMocks.orderBy.mockReturnValue('order-clause');
    firestoreMocks.limit.mockReturnValue('limit-clause');
    firestoreMocks.query.mockReturnValue('query-clause');
  });

  it('loads ranked mode stats with player number, wins, and games played', async () => {
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'player-1',
          data: () => ({
            displayName: 'Top Player',
            photoURL: 'photo.png',
            gamesPlayed: 10,
            wins: 6,
            modeStats: { offline: { gamesPlayed: 4, wins: 3 } },
          }),
        },
      ],
    });

    await expect(loadWebsiteLeaderboard({ mode: 'offline', limitCount: 100 })).resolves.toEqual([
      {
        rank: 1,
        userId: 'player-1',
        displayName: 'Top Player',
        photoURL: 'photo.png',
        gamesPlayed: 4,
        wins: 3,
      },
    ]);
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('modeStats.offline.wins', 'desc');
    expect(firestoreMocks.limit).toHaveBeenCalledWith(50);
    expect(firestoreMocks.query).toHaveBeenCalledWith('leaderboard-collection', 'order-clause', 'limit-clause');
  });

  it('orders aggregate rankings by total wins', async () => {
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [{ id: 'player-2', data: () => ({ displayName: 'Winner', gamesPlayed: 9, wins: 8 }) }],
    });

    await expect(loadWebsiteLeaderboard({ mode: 'total' })).resolves.toMatchObject([
      { rank: 1, userId: 'player-2', displayName: 'Winner', gamesPlayed: 9, wins: 8 },
    ]);
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('wins', 'desc');
  });
});

import { describe, expect, it } from 'vitest';
import { encryptCrazyGamesScore } from './crazyGamesLeaderboard.js';

describe('CrazyGames leaderboard adapter', () => {
  it('does not attempt encryption when no portal key is configured', async () => {
    await expect(encryptCrazyGamesScore(3, null)).resolves.toBeNull();
  });
});

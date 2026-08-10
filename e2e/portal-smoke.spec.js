import { expect, test } from '@playwright/test';

const CRAZYGAMES_SDK_MOCK = `
  (() => {
    const data = { dyut_stats: '{"displayName":"QA Player","gamesPlayed":1,"wins":1,"xp":100,"level":2,"coins":250,"ownedPieceSkinIds":["classic","faceted"]}' };
    const joinListeners = new Set();
    window.__dyutCrazyGamesData = data;
    window.CrazyGames = {
      SDK: {
        async init() {},
        game: {
          loadingStart() {},
          loadingStop() {},
          leftRoom() {},
          addJoinRoomListener(listener) { joinListeners.add(listener); },
          removeJoinRoomListener(listener) { joinListeners.delete(listener); },
          settings: { muteAudio: false },
          isInstantMultiplayer: false,
          inviteParams: null
        },
        user: {
          isUserAccountAvailable: false,
          async getUser() { return { username: 'QA Player' }; },
          addAuthListener() {},
          removeAuthListener() {}
        },
        data: {
          async getItem(key) { return data[key] ?? null; },
          async setItem(key, value) { data[key] = value; }
        }
      }
    };
  })();
`;

test.beforeEach(async ({ page }) => {
  await page.route('https://sdk.crazygames.com/crazygames-sdk-v3.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: CRAZYGAMES_SDK_MOCK
  }));
});

test('Basic Launch portal menu keeps the free flow visible and ads absent', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: /play now/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /play online/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /custom game/i })).toBeVisible();
  await expect(page.locator('#cg-lobby-banner-left')).toHaveCount(0);
  await expect(page.locator('#cg-lobby-banner-right')).toHaveCount(0);
});

test('portal collection purchases a piece design using earned coins', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /open collection/i }).click();
  await expect(page.getByRole('dialog', { name: /piece collection/i })).toBeVisible();
  await page.getByRole('button', { name: 'Buy' }).first().click();

  await expect(page.getByText(/600 coins/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dyutCrazyGamesData.dyut_piece_skin_id)).toBe('"halo"');
});

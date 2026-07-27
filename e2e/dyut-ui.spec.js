import { expect, test } from '@playwright/test';

const LONG_PLAYER_NAME = 'A Very Long CrazyGames Player Name That Must Be Truncated';
const QA_ECONOMY_KEY = 'dyut_economy:qa-user';

const clearSavedState = async (page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dyut_test_storage_cleared') !== 'true') {
      localStorage.clear();
      sessionStorage.setItem('dyut_test_storage_cleared', 'true');
    }
  });
};

const expectNoViewportOverflow = async (page) => {
  const overflow = await page.evaluate(() => ({
    horizontal: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    vertical: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
  }));

  expect(overflow.horizontal).toBeLessThanOrEqual(1);
  expect(overflow.vertical).toBeLessThanOrEqual(1);
};

test.beforeEach(async ({ page }) => {
  await clearSavedState(page);
});

test('main menu fits desktop and compact landscape viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 800, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.lobby-viewport')).toBeVisible();
    await expect(page.getByRole('button', { name: /single player|local play/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /online match/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^play with friends\b/i })).toBeVisible();
    await expectNoViewportOverflow(page);
  }
});

test('local setup starts a playable game', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /single player|local play/i }).click();
  await expect(page.locator('.lobby-seat-layout')).toBeVisible();
  await page.getByRole('button', { name: /start match/i }).click();

  await expect(page.locator('.board-bounding-box')).toBeVisible();
  await expect(page.locator('#dice-roll-btn')).toBeVisible();
  await expect(page.locator('[data-player-base-card="Player1"]')).toBeVisible();
  await expectNoViewportOverflow(page);
});

test('local players can share a piece design while seat colors stay unique', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /single player|local play/i }).click();
  const designSelectors = page.locator('select[aria-label^="Piece design for"]:not([disabled])');
  await expect(designSelectors).toHaveCount(2);
  await designSelectors.nth(0).selectOption('lotus');
  await designSelectors.nth(1).selectOption('lotus');
  await page.getByRole('button', { name: /start match/i }).click();

  await expect(page.locator('.board-bounding-box')).toBeVisible();
  const lotusPieces = page.locator('[data-piece-skin="lotus"]');
  await expect(lotusPieces).toHaveCount(8);
  await expect(lotusPieces.first()).toContainText('✤');
  const seatColors = await lotusPieces.evaluateAll((pieces) => (
    [...new Set(pieces.map((piece) => piece.dataset.seatColor))].sort()
  ));
  expect(seatColors).toHaveLength(2);
  await expectNoViewportOverflow(page);
});

test('Play with Friends opens private configuration and returns to the menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /^play with friends\b/i }).click();
  await expect(page.locator('.lobby-config-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: /play with friends/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /ffa 4p/i })).toBeVisible();

  await page.getByRole('button', { name: /^back$/i }).click();
  await expect(page.getByRole('button', { name: /^play with friends\b/i })).toBeVisible();
});

test('victory screen exposes New Game and Home actions', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto('/?qa=victory', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: /^new game$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^home$/i })).toBeVisible();
  await expect(page.getByText('QA Champion')).toBeVisible();
  await expectNoViewportOverflow(page);
});

test('long player names stay above the base and render with ellipsis', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto('/?qa=long-name', { waitUntil: 'domcontentloaded' });

  const baseCard = page.locator('[data-player-base-card="Player1"]');
  const nameLabel = page.locator(`[title="${LONG_PLAYER_NAME}"]`);
  await expect(baseCard).toBeVisible();
  await expect(nameLabel).toBeVisible();

  const layout = await nameLabel.evaluate((label) => {
    const card = label.parentElement?.nextElementSibling;
    const labelRect = label.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const style = getComputedStyle(label);

    return {
      isAboveCard: Boolean(cardRect) && labelRect.bottom <= cardRect.top + 1,
      isTruncated: label.scrollWidth > label.clientWidth,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    };
  });

  expect(layout).toMatchObject({
    isAboveCard: true,
    isTruncated: true,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });
  await expectNoViewportOverflow(page);
});

test('daily login grants 500 coins once and remains idempotent after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?qa=economy', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('coin-balance')).toContainText('500');
  await expect(page.getByTestId('daily-reward-notice')).toContainText('+500');

  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('coin-balance')).toContainText('500');
  await expect(page.getByTestId('daily-reward-notice')).toHaveCount(0);
  await expectNoViewportOverflow(page);
});

test('public Online Match discloses the 500 entry and 10 percent fee', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?qa=economy', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('coin-balance')).toContainText('500');
  await page.getByRole('button', { name: /online match/i }).click();

  const disclosure = page.getByTestId('public-match-fee');
  await expect(disclosure).toContainText('500');
  await expect(disclosure).toContainText('10%');
  await expect(disclosure).toContainText('90%');
  await expectNoViewportOverflow(page);
});

test('public Online Match is blocked below 500 while free modes remain available', async ({ page }) => {
  await page.addInitScript(({ key, dayKey }) => {
    localStorage.setItem(key, JSON.stringify({
      coins: 499,
      lastDailyRewardDay: dayKey,
      version: 1,
      events: {
        [`daily:${dayKey}`]: {
          type: 'daily_login',
          delta: 500,
          balanceAfter: 499,
          dayKey,
          createdAt: Date.now(),
        },
      },
    }));
  }, {
    key: QA_ECONOMY_KEY,
    dayKey: new Date().toISOString().slice(0, 10),
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?qa=economy-insufficient', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('coin-balance')).toContainText('499');
  await page.getByRole('button', { name: /online match/i }).click();
  await expect(page.getByRole('alert')).toContainText('500');
  await expect(page.getByRole('button', { name: /single player|local play/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^play with friends\b/i })).toBeVisible();
  await expectNoViewportOverflow(page);
});

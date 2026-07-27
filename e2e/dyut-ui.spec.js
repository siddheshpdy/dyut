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

const expectReadableText = async (locator, minimumRatio = 4.5) => {
  const reports = await locator.evaluateAll((nodes) => {
    const backdrop = [18, 15, 12];
    const parseColor = (value) => {
      const values = value.match(/[\d.]+/g)?.map(Number) || [];
      const usesUnitChannels = value.startsWith('color(srgb');
      return {
        rgb: values.slice(0, 3).map((channel) => usesUnitChannels ? channel * 255 : channel),
        alpha: values.length > 3 ? values[3] : 1,
      };
    };
    const luminance = (rgb) => {
      const channels = rgb.map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    };
    const contrast = (first, second) => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };

    return nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((node) => {
        const colorValue = getComputedStyle(node).color;
        const color = parseColor(colorValue);
        let ancestorOpacity = 1;
        for (let current = node; current; current = current.parentElement) {
          ancestorOpacity *= Number(getComputedStyle(current).opacity || 1);
        }
        const alpha = color.alpha * ancestorOpacity;
        const renderedColor = color.rgb.map((channel, index) => (
          (channel * alpha) + (backdrop[index] * (1 - alpha))
        ));
        return {
          text: node.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
          ratio: contrast(renderedColor, backdrop),
          colorValue,
          ancestorOpacity,
        };
      });
  });

  expect(reports.length).toBeGreaterThan(0);
  for (const report of reports) {
    expect(report.ratio, `${report.text} contrast ratio (${report.colorValue}, opacity ${report.ancestorOpacity})`).toBeGreaterThanOrEqual(minimumRatio);
  }
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

test('major menu and setup text keeps readable contrast', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.lobby-viewport')).toBeVisible();
  await expectReadableText(page.locator('.lobby-viewport p'));
  await page.getByRole('button', { name: /online match/i }).click();
  await expectReadableText(page.locator('.lobby-config-card-title'));
  await expectReadableText(page.locator('.lobby-config-card-subtitle'));

  await page.getByRole('button', { name: /^back$/i }).click();
  await page.getByRole('button', { name: /single player|local play/i }).click();
  await expectReadableText(page.locator('.lobby-seat-label'));
  await expectNoViewportOverflow(page);
});

test('public setup stays readable in compact landscape', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.lobby-viewport')).toBeVisible();
  await page.getByRole('button', { name: /online match/i }).click();
  const oneOnOne = page.getByRole('button', { name: /1 vs 1/i });
  const twoVsTwo = page.getByRole('button', { name: /2 vs 2/i });
  const freeForAll = page.getByRole('button', { name: /ffa 4p/i });

  await expect(oneOnOne).toHaveAttribute('aria-pressed', 'true');
  await expect(oneOnOne.locator('.lobby-config-selected-badge')).toBeVisible();
  await expect(twoVsTwo).toBeEnabled();
  await expect(twoVsTwo).toHaveAttribute('aria-pressed', 'false');
  await expect(freeForAll).toHaveAttribute('aria-pressed', 'false');
  await twoVsTwo.click();
  await expect(oneOnOne).toHaveAttribute('aria-pressed', 'false');
  await expect(twoVsTwo).toHaveAttribute('aria-pressed', 'true');
  await expect(twoVsTwo.locator('.lobby-config-selected-badge')).toBeVisible();
  await expect(page.getByTestId('public-match-fee')).toContainText('Winning team gets 90% of the pool');
  await freeForAll.click();
  await expect(twoVsTwo).toHaveAttribute('aria-pressed', 'false');
  await expect(freeForAll).toHaveAttribute('aria-pressed', 'true');
  await expect(freeForAll.locator('.lobby-config-selected-badge')).toBeVisible();
  await expectReadableText(page.locator('.lobby-config-card-title'));
  await expectNoViewportOverflow(page);
});

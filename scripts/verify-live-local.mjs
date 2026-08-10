import { chromium } from 'playwright';

const baseUrl = process.env.DYUT_BASE_URL || 'http://localhost:5173';
const sdkMock = `
  window.CrazyGames = { SDK: {
    async init() {},
    game: { loadingStart() {}, loadingStop() {}, settings: { muteAudio: false } },
    user: { isUserAccountAvailable: false, async getUser() { return null; }, addAuthListener() {}, removeAuthListener() {} },
    data: { async getItem() { return null; }, async setItem() {}, async removeItem() {} }
  }};
`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.route('https://sdk.crazygames.com/crazygames-sdk-v3.js', (route) => route.fulfill({ contentType: 'application/javascript', body: sdkMock }));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /play now/i }).waitFor({ state: 'visible', timeout: 30_000 });

  for (const [label, exitLabel] of [[/how to play/i, /exit tutorial/i], [/^rules$/i, /^return$/i], [/^history$/i, /^return$/i], [/about us/i, /^return$/i]]) {
    await page.getByRole('button', { name: label }).click();
    await page.getByRole('button', { name: exitLabel }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: exitLabel }).click();
  }

  await page.getByRole('button', { name: /play now/i }).click();
  await page.getByRole('button', { name: /roll dice/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('button[aria-label="Close"]').first().click().catch(() => {});
  await page.getByRole('button', { name: /roll dice/i }).click();
  await page.waitForTimeout(1_700);

  const gameText = await page.locator('body').innerText();
  if (!/current dice[\s\S]*[1346]/i.test(gameText)) throw new Error('Local roll result was not displayed.');
  await page.screenshot({ path: 'artifacts/live-local-gameplay.png', fullPage: true });
  console.log(JSON.stringify({ status: 'passed', checks: ['menu information screens', 'local bot match launch', 'first-turn dice roll'] }));
} finally {
  await context.close();
  await browser.close();
}

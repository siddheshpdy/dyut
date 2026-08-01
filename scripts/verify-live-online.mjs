import { chromium } from 'playwright';

const baseUrl = process.env.DYUT_BASE_URL || 'http://localhost:5173';
const sdkMock = `
  (() => {
    const data = {};
    window.CrazyGames = { SDK: {
      async init() {},
      game: { loadingStart() {}, loadingStop() {}, leftRoom() {}, settings: { muteAudio: false }, addJoinRoomListener() {}, removeJoinRoomListener() {} },
      user: { isUserAccountAvailable: false, async getUser() { return null; }, addAuthListener() {}, removeAuthListener() {} },
      data: { async getItem(key) { return data[key] ?? null; }, async setItem(key, value) { data[key] = value; }, async removeItem(key) { delete data[key]; } }
    }};
  })();
`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const preparePage = async (context, consoleMessages) => {
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleMessages.push(message.text());
  });
  await page.route('https://sdk.crazygames.com/crazygames-sdk-v3.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: sdkMock,
  }));
  await page.addInitScript(() => localStorage.clear());
  return page;
};

const waitForText = async (page, pattern, timeout = 30_000) => {
  await page.waitForFunction((source) => new RegExp(source, 'i').test(document.body.innerText), pattern.source, { timeout });
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const hostContext = await browser.newContext();
const guestContext = await browser.newContext();
let host;
let guest;
const consoleMessages = [];

try {
  host = await preparePage(hostContext, consoleMessages);
  await host.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForText(host, /play online/);
  await host.getByRole('button', { name: /play online/i }).click();
  await waitForText(host, /public lobby\s*-\s*id:/);

  const hostLobbyText = await host.locator('body').innerText();
  const lobbyId = hostLobbyText.match(/public lobby\s*-\s*id:\s*([A-Z0-9]+)/i)?.[1];
  if (!lobbyId) throw new Error('Could not extract the live public lobby ID.');

  guest = await preparePage(guestContext, consoleMessages);
  await guest.goto(`${baseUrl}/?join=${lobbyId}`, { waitUntil: 'domcontentloaded' });
  await waitForText(guest, /public lobby\s*-\s*id:/);
  await waitForText(host, /waiting for host|start match/);
  await host.getByRole('button', { name: /start match/i }).click();
  await delay(1_000);

  await host.getByRole('button', { name: /roll dice/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await guest.getByRole('button', { name: /roll dice/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await host.locator('button[aria-label="Close"]').first().click().catch(() => {});
  await guest.locator('button[aria-label="Close"]').first().click().catch(() => {});

  await host.getByRole('button', { name: /roll dice/i }).click();
  await delay(1_700);

  const guestGameText = await guest.locator('body').innerText();
  if (!/current dice[\s\S]*[1346]/i.test(guestGameText)) {
    throw new Error('Guest did not receive the host roll state.');
  }
  if (!await guest.getByRole('button', { name: /roll dice/i }).isDisabled()) {
    throw new Error('Guest was incorrectly allowed to roll during the host turn.');
  }

  console.log(JSON.stringify({ status: 'passed', lobbyId, checks: ['lobby creation', 'guest join', 'match start', 'host roll sync', 'turn authority'] }));
} catch (error) {
  await host?.screenshot({ path: 'artifacts/live-online-host-failure.png', fullPage: true }).catch(() => {});
  await guest?.screenshot({ path: 'artifacts/live-online-guest-failure.png', fullPage: true }).catch(() => {});
  console.error(JSON.stringify({
    status: 'failed',
    message: error.message,
    hostText: (await host?.locator('body').innerText().catch(() => ''))?.slice(0, 3000),
    guestText: (await guest?.locator('body').innerText().catch(() => ''))?.slice(0, 3000),
    consoleMessages,
  }));
  throw error;
} finally {
  await hostContext.close();
  await guestContext.close();
  await browser.close();
}

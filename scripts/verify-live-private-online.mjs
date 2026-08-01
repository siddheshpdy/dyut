import { chromium } from 'playwright';

const baseUrl = process.env.DYUT_BASE_URL || 'http://localhost:5175';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForText = (page, pattern, timeout = 30_000) => page.waitForFunction((source) => new RegExp(source, 'i').test(document.body.innerText), pattern.source, { timeout });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const hostContext = await browser.newContext();
const guestContext = await browser.newContext();
let host;
let guest;
const consoleMessages = [];

try {
  host = await hostContext.newPage();
  host.on('console', (message) => { if (message.type() === 'error') consoleMessages.push(message.text()); });
  host.on('pageerror', (error) => consoleMessages.push(`pageerror: ${error.message}`));
  await host.addInitScript(() => localStorage.clear());
  await host.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await delay(10_000);
  await host.getByRole('button', { name: /private match/i }).click();
  await host.getByRole('button', { name: /create lobby/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await host.getByRole('button', { name: /create lobby/i }).click();
  await waitForText(host, /private lobby\s*-\s*id:/);
  await host.getByRole('button', { name: /claim seat/i }).nth(1).click();
  await delay(1_000);

  const hostLobbyText = await host.locator('body').innerText();
  const lobbyId = hostLobbyText.match(/private lobby\s*-\s*id:\s*([A-Z0-9]+)/i)?.[1];
  if (!lobbyId) throw new Error('Could not extract private lobby ID.');

  guest = await guestContext.newPage();
  guest.on('console', (message) => { if (message.type() === 'error') consoleMessages.push(message.text()); });
  guest.on('pageerror', (error) => consoleMessages.push(`pageerror: ${error.message}`));
  await guest.addInitScript(() => localStorage.clear());
  await guest.goto(`${baseUrl}/?join=${lobbyId}`, { waitUntil: 'domcontentloaded' });
  await delay(10_000);
  const guestSeatClaim = guest.getByRole('button', { name: /claim seat/i }).first();
  await guestSeatClaim.waitFor({ state: 'visible', timeout: 30_000 });
  await guestSeatClaim.click();
  await waitForText(host, /PLAYER 3[\s\S]*TAKEN/);
  await host.getByRole('button', { name: /start match/i }).click();

  await host.getByRole('button', { name: /roll dice/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await guest.getByRole('button', { name: /roll dice/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await host.locator('button[aria-label="Close"]').first().click().catch(() => {});
  await guest.locator('button[aria-label="Close"]').first().click().catch(() => {});
  await host.getByRole('button', { name: /roll dice/i }).click();
  await delay(1_700);

  if (!/current dice[\s\S]*[1346]/i.test(await guest.locator('body').innerText())) throw new Error('Guest did not receive the host roll state.');
  if (!await guest.getByRole('button', { name: /roll dice/i }).isDisabled()) throw new Error('Guest was allowed to roll during the host turn.');

  console.log(JSON.stringify({ status: 'passed', lobbyId, checks: ['private lobby', 'manual seat claim', 'match start', 'host roll sync', 'turn authority'] }));
} catch (error) {
  await host?.screenshot({ path: 'artifacts/live-private-online-host-failure.png', fullPage: true }).catch(() => {});
  await guest?.screenshot({ path: 'artifacts/live-private-online-guest-failure.png', fullPage: true }).catch(() => {});
  console.error(JSON.stringify({ status: 'failed', message: error.message, hostText: (await host?.locator('body').innerText().catch(() => ''))?.slice(0, 3000), guestText: (await guest?.locator('body').innerText().catch(() => ''))?.slice(0, 3000), consoleMessages }));
  throw error;
} finally {
  await hostContext.close();
  await guestContext.close();
  await browser.close();
}

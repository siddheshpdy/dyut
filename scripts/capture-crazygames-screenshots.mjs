import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VIEWPORTS = [
  ['1920x1080', 1920, 1080],
  ['1366x768', 1366, 768],
  ['1080x607', 1080, 607],
  ['907x510', 907, 510],
  ['821x462', 821, 462],
  ['800x450', 800, 450],
  ['768x1024', 768, 1024],
  ['430x932', 430, 932],
  ['390x844', 390, 844],
  ['360x800', 360, 800],
];

// Each capture verifies the screen-specific content that must be visible, in
// addition to every visible interactive control on the page.
const REQUIRED_ELEMENTS = {
  lobby: ['.lobby-viewport'],
  configuration: ['.lobby-config-panel'],
  'seat-setup': ['.lobby-seat-layout', '.lobby-seat-primary-action'],
  tutorial: ['.tutorial-info', '.board-bounding-box', '#dice-roll-btn'],
  rules: ['.secondary-screen-card', '.rules-section-tabs'],
  history: ['.secondary-screen-card'],
  about: ['.secondary-screen-card'],
  game: ['.board-bounding-box', '#dice-roll-btn'],
  'resume-dialog': ['[role="dialog"]'],
  victory: ['section', 'section button'],
};

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const isPortal = args.has('--portal');
const mode = isPortal ? 'crazygames' : 'development';
const outputDirectory = path.resolve(
  ROOT,
  [...args].find((argument) => argument.startsWith('--output='))?.slice('--output='.length)
    || path.join('artifacts', 'viewport-screenshots', mode),
);
const requestedViewports = [...args]
  .filter((argument) => argument.startsWith('--viewport='))
  .map((argument) => argument.slice('--viewport='.length));
const viewports = requestedViewports.length
  ? VIEWPORTS.filter(([name]) => requestedViewports.includes(name))
  : VIEWPORTS;
const chromeProfileDirectory = path.join(tmpdir(), `dyut-screenshot-profile-${process.pid}`);
const viteEntry = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const findChrome = () => {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
};

const waitFor = async (predicate, description, timeout = 15_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}.`);
};

const startVite = async () => {
  if (!existsSync(viteEntry)) {
    throw new Error('Vite is not installed. Run npm install before capturing screenshots.');
  }

  const viteArgs = [viteEntry, '--host', '127.0.0.1', '--port', '0'];
  if (isPortal) viteArgs.push('--mode', 'crazygames');

  const processHandle = spawn(process.execPath, viteArgs, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  const receiveOutput = (chunk) => { output += chunk.toString(); };
  processHandle.stdout.on('data', receiveOutput);
  processHandle.stderr.on('data', receiveOutput);

  await waitFor(() => /http:\/\/127\.0\.0\.1:\d+\//.test(output), 'Vite to start');
  const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
  if (!url) throw new Error(`Vite did not report a local URL:\n${output}`);
  return { processHandle, url };
};

const startChrome = async () => {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Google Chrome was not found. Set CHROME_PATH to chrome.exe and run the command again.');
  }

  await fs.mkdir(chromeProfileDirectory, { recursive: true });
  const processHandle = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${chromeProfileDirectory}`,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  const portFile = path.join(chromeProfileDirectory, 'DevToolsActivePort');
  await waitFor(() => existsSync(portFile), 'Chrome remote debugging');
  let port;
  await waitFor(async () => {
    try {
      [port] = (await fs.readFile(portFile, 'utf8')).split(/\r?\n/);
      return Boolean(port);
    } catch (error) {
      if (error.code !== 'EBUSY') throw error;
      return false;
    }
  }, 'Chrome debugger port');
  return { processHandle, debuggerUrl: `http://127.0.0.1:${port}` };
};

const createCdpClient = async (debuggerUrl) => {
  const targets = await (await fetch(`${debuggerUrl}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a debuggable page.');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    pending.get(message.id)(message);
    pending.delete(message.id);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (message) => {
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result.result.value;
  };

  return { socket, send, evaluate };
};

const clickButton = (evaluate, labels) => evaluate(`(() => {
  const labels = ${JSON.stringify(labels.map((label) => label.toUpperCase()))};
  const button = [...document.querySelectorAll('button')].find((node) =>
    labels.some((label) => node.textContent.toUpperCase().includes(label))
  );
  if (!button) return false;
  button.click();
  return true;
})()`);

const waitForApp = (evaluate) => waitFor(
  async () => evaluate('document.querySelectorAll("button").length > 0 || document.querySelector("h1")?.textContent?.includes("VICTORY")'),
  'the app to render',
);

const writeScreenshot = async (client, screen, viewportName, manifest) => {
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const fileName = `${screen}-${viewportName}.png`;
  await fs.writeFile(path.join(outputDirectory, fileName), Buffer.from(screenshot.data, 'base64'));
  manifest.screenshots.push(fileName);
};

const inspectVisibility = async (evaluate, screen) => {
  const required = REQUIRED_ELEMENTS[screen] || [];
  const report = JSON.parse(await evaluate(`(() => {
    const required = ${JSON.stringify(required)};
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const isVisible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const isInViewport = (node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1;
    };
    const describe = (node) => {
      const rect = node.getBoundingClientRect();
      return { label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().replace(/\\s+/g, ' ').slice(0, 80), rect: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) } };
    };
    const missingRequired = required.filter((selector) => ![...document.querySelectorAll(selector)].some((node) => isVisible(node) && isInViewport(node)));
    const clippedControls = [...document.querySelectorAll('button, input, select, textarea, a[href]')]
      .filter(isVisible)
      .filter((node) => !isInViewport(node))
      .map(describe);
    const pageOverflow = {
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
    };
    const hasOverflow = pageOverflow.documentWidth > viewport.width || pageOverflow.documentHeight > viewport.height || pageOverflow.bodyWidth > viewport.width || pageOverflow.bodyHeight > viewport.height;
    return JSON.stringify({
      required,
      visibleControlCount: [...document.querySelectorAll('button, input, select, textarea, a[href]')].filter(isVisible).length,
      missingRequired,
      clippedControls,
      pageOverflow,
      hasOverflow,
      ok: !hasOverflow && missingRequired.length === 0 && clippedControls.length === 0,
    });
  })()`));

  return report;
};

const run = async () => {
  if (!viewports.length) {
    throw new Error(`No matching viewport. Use one of: ${VIEWPORTS.map(([name]) => name).join(', ')}`);
  }

  await fs.mkdir(outputDirectory, { recursive: true });
  const manifest = {
    createdAt: new Date().toISOString(),
    mode,
    viewports: viewports.map(([name, width, height]) => ({ name, width, height })),
    screenshots: [],
    checks: [],
    failures: [],
  };
  let vite;
  let chrome;
  let client;

  try {
    vite = await startVite();
    chrome = await startChrome();
    client = await createCdpClient(chrome.debuggerUrl);

    let navigationId = 0;
    const open = async (url = vite.url) => {
      const target = new URL(url);
      if (!target.searchParams.has('qa')) target.searchParams.set('qa', 'capture');
      target.searchParams.set('capture', String(navigationId++));
      await client.send('Page.navigate', { url: target.href });
      await sleep(500);
      await waitForApp(client.evaluate);
      await sleep(250);
    };
    const clearOfflineResume = async () => {
      await client.evaluate("localStorage.removeItem('dyut_game_state'); localStorage.removeItem('dyut_player_count');");
      await open();
    };
    const captureFlow = async (screen, viewportName, action, url) => {
      try {
        if (screen !== 'resume-dialog') {
          await client.evaluate("localStorage.removeItem('dyut_game_state'); localStorage.removeItem('dyut_player_count');");
        }
        await open(url);
        if (action) {
          const completed = await action();
          if (!completed) throw new Error(`Could not navigate to ${screen}.`);
          await sleep(250);
        }
        const check = await inspectVisibility(client.evaluate, screen);
        manifest.checks.push({ screen, viewport: viewportName, ...check });
        await writeScreenshot(client, screen, viewportName, manifest);
        if (!check.ok) {
          const issues = [
            check.missingRequired.length && `missing required: ${check.missingRequired.join(', ')}`,
            check.clippedControls.length && `clipped controls: ${check.clippedControls.map((control) => control.label).join(', ')}`,
            check.hasOverflow && 'page overflow',
          ].filter(Boolean).join('; ');
          throw new Error(`Visibility check failed (${issues}).`);
        }
      } catch (error) {
        manifest.failures.push({ screen, viewport: viewportName, error: error.message });
      }
    };

    for (const [viewportName, width, height] of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await captureFlow('lobby', viewportName);
      await captureFlow('configuration', viewportName, () => clickButton(client.evaluate, ['ONLINE MATCH', 'CUSTOM GAME']));
      await captureFlow('seat-setup', viewportName, async () => {
        await clearOfflineResume();
        if (await clickButton(client.evaluate, ['SINGLE PLAYER / LOCAL', 'LOCAL PLAY'])) return true;
        if (!await clickButton(client.evaluate, ['CUSTOM GAME'])) return false;
        await sleep(200);
        return clickButton(client.evaluate, ['NEXT']);
      });
      await captureFlow('tutorial', viewportName, () => clickButton(client.evaluate, ['HOW TO PLAY']));
      await captureFlow('rules', viewportName, () => clickButton(client.evaluate, ['RULES']));
      await captureFlow('history', viewportName, () => clickButton(client.evaluate, ['HISTORY']));
      await captureFlow('about', viewportName, () => clickButton(client.evaluate, ['ABOUT US']));
      await captureFlow('game', viewportName, async () => {
        await clearOfflineResume();
        if (isPortal) {
          if (!await clickButton(client.evaluate, ['CUSTOM GAME'])) return false;
          await sleep(200);
          if (!await clickButton(client.evaluate, ['NEXT'])) return false;
        } else if (!await clickButton(client.evaluate, ['SINGLE PLAYER / LOCAL', 'LOCAL PLAY'])) {
          return false;
        }
        await sleep(150);
        await clickButton(client.evaluate, ['NEW GAME']);
        await sleep(150);
        return clickButton(client.evaluate, ['START MATCH']);
      });
      await captureFlow('resume-dialog', viewportName, null, `${vite.url}?qa=resume`);
      await captureFlow('victory', viewportName, null, `${vite.url}?qa=victory`);
    }
  } finally {
    await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (client?.socket) client.socket.close();
    if (chrome?.processHandle && !chrome.processHandle.killed) chrome.processHandle.kill();
    if (vite?.processHandle && !vite.processHandle.killed) vite.processHandle.kill();
    await sleep(250);
    await fs.rm(chromeProfileDirectory, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`Saved ${manifest.screenshots.length} screenshots to ${outputDirectory}`);
  if (manifest.failures.length) {
    console.error(`Failed to capture ${manifest.failures.length} screen(s). See manifest.json for details.`);
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

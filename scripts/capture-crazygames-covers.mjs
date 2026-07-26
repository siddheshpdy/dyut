import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'artifacts', 'crazygames-submission', 'covers');
const PROFILE = path.join(tmpdir(), `dyut-cover-capture-${process.pid}`);
const VITE_ENTRY = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const COVERS = [
  ['landscape-1920x1080', 1920, 1080],
  ['portrait-800x1200', 800, 1200],
  ['square-800x800', 800, 800],
];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitFor = async (predicate, label, timeout = 15_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

const findChrome = () => [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].find((candidate) => candidate && existsSync(candidate));

const startVite = async () => {
  const processHandle = spawn(process.execPath, [VITE_ENTRY, '--host', '127.0.0.1', '--port', '0'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  const onOutput = (data) => { output += data.toString(); };
  processHandle.stdout.on('data', onOutput);
  processHandle.stderr.on('data', onOutput);
  await waitFor(() => /http:\/\/127\.0\.0\.1:\d+\//.test(output), 'Vite');
  return { processHandle, url: output.match(/http:\/\/127\.0\.0\.1:\d+\//)[0] };
};

const startChrome = async () => {
  const chrome = findChrome();
  if (!chrome) throw new Error('Google Chrome was not found. Set CHROME_PATH to chrome.exe and rerun the command.');
  await fs.mkdir(PROFILE, { recursive: true });
  const processHandle = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${PROFILE}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const portFile = path.join(PROFILE, 'DevToolsActivePort');
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
  return { processHandle, endpoint: `http://127.0.0.1:${port}` };
};

const createClient = async (endpoint) => {
  const targets = await (await fetch(`${endpoint}/json/list`)).json();
  const target = targets.find((candidate) => candidate.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a debuggable page.');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
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
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  return { socket, send, evaluate };
};

let vite;
let chrome;
let client;
try {
  await fs.mkdir(OUTPUT, { recursive: true });
  vite = await startVite();
  chrome = await startChrome();
  client = await createClient(chrome.endpoint);

  for (const [name, width, height] of COVERS) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await client.send('Page.navigate', { url: `${vite.url}?qa=scenario&cover=${name}` });
    await waitFor(() => client.evaluate('Boolean(document.querySelector(".board-bounding-box"))'), `${name} board`);
    await client.evaluate(`(() => {
      const mobileTitle = [...document.querySelectorAll('.dyut-title')]
        .find((node) => node.tagName !== 'H1');
      const titleBlock = mobileTitle?.parentElement;
      if (!titleBlock) return false;
      const header = titleBlock.parentElement;
      const controls = titleBlock.nextElementSibling;
      header?.style.setProperty('min-height', '3.7rem');
      titleBlock.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:0.55rem',
        'width:max-content',
        'transform:translateX(-50%)',
        'text-align:center',
        'pointer-events:none',
      ].join(';');
      controls?.style.setProperty('position', 'absolute');
      controls?.style.setProperty('right', '0.6rem');
      controls?.style.setProperty('top', '0.7rem');
      return true;
    })()`);
    await sleep(500);
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const destination = path.join(OUTPUT, `dyut-cover-${name}.png`);
    await fs.writeFile(destination, Buffer.from(screenshot.data, 'base64'));
    console.log(`Created ${destination}`);
  }
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  client?.socket.close();
  if (chrome?.processHandle && !chrome.processHandle.killed) chrome.processHandle.kill();
  if (vite?.processHandle && !vite.processHandle.killed) vite.processHandle.kill();
  await fs.rm(PROFILE, { recursive: true, force: true }).catch(() => {});
}

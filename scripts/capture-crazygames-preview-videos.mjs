import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'artifacts', 'crazygames-submission');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(tmpdir(), `dyut-preview-video-${process.pid}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, label, timeout = 15000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const startVite = async () => {
  const processHandle = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '0'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  processHandle.stdout.on('data', (data) => { output += data.toString(); });
  processHandle.stderr.on('data', (data) => { output += data.toString(); });
  await waitFor(() => /http:\/\/127\.0\.0\.1:\d+\//.test(output), 'Vite');
  return { processHandle, url: output.match(/http:\/\/127\.0\.0\.1:\d+\//)[0] };
};

const startChrome = async () => {
  if (!existsSync(CHROME)) throw new Error('Google Chrome was not found.');
  await fs.mkdir(PROFILE, { recursive: true });
  const processHandle = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const portFile = path.join(PROFILE, 'DevToolsActivePort');
  await waitFor(() => existsSync(portFile), 'Chrome debugging port');
  let port;
  await waitFor(async () => {
    try {
      [port] = (await fs.readFile(portFile, 'utf8')).split(/\r?\n/);
      return Boolean(port);
    } catch (error) {
      if (error.code !== 'EBUSY') throw error;
      return false;
    }
  }, 'Chrome debugging port details');
  return { processHandle, endpoint: `http://127.0.0.1:${port}` };
};

const createClient = async (endpoint, webSocketDebuggerUrl = null) => {
  let debuggerUrl = webSocketDebuggerUrl;
  if (!debuggerUrl) {
    const targets = await (await fetch(`${endpoint}/json/list`)).json();
    const target = targets.find((candidate) => candidate.type === 'page' && candidate.url === 'about:blank')
      || targets.find((candidate) => candidate.type === 'page');
    debuggerUrl = target?.webSocketDebuggerUrl;
  }
  if (!debuggerUrl) throw new Error('Chrome did not expose a debuggable page.');
  const socket = new WebSocket(debuggerUrl);
  const pending = new Map(); let nextId = 1;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    pending.get(message.id)(message); pending.delete(message.id);
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  return { socket, send, evaluate };
};

const click = (evaluate, labels) => evaluate(`(() => {
  const labels = ${JSON.stringify(labels.map((label) => label.toUpperCase()))};
  const button = [...document.querySelectorAll('button')].find((node) => labels.some((label) => node.textContent.toUpperCase().includes(label)) && !node.disabled);
  if (!button) return false; button.click(); return true;
})()`);

const openGame = async (client, url, width, height) => {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url: `${url}?qa=capture&video=capture-${width}` });
  await waitFor(() => client.evaluate('document.querySelectorAll("button").length > 0'), 'game menu');
  await click(client.evaluate, ['SINGLE PLAYER / LOCAL', 'LOCAL PLAY']);
  await sleep(250);
  await click(client.evaluate, ['NEW GAME']);
  await sleep(250);
  await click(client.evaluate, ['START MATCH']);
  await waitFor(() => client.evaluate('Boolean(document.querySelector("#dice-roll-btn"))'), 'game board');
  await click(client.evaluate, ['GOT IT']);
  await sleep(500);
};

const beginRecorder = (client, width, height) => client.evaluate(`(() => new Promise((resolve) => {
  const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
  const context = canvas.getContext('2d'); const stream = canvas.captureStream(4); const track = stream.getVideoTracks()[0];
  const chunks = []; const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.42E01E', videoBitsPerSecond: 4500000 });
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); window.__dyutVideo = btoa(binary); resolve(true); };
  window.__dyutRecorder = { recorder, context, track, canvas }; recorder.start(); resolve(true);
})())`);

const addFrame = (client, png) => client.evaluate(`(async () => {
  const image = new Image(); image.src = 'data:image/png;base64,${png}'; await image.decode();
  const { context, canvas, track } = window.__dyutRecorder; context.drawImage(image, 0, 0, canvas.width, canvas.height); track.requestFrame(); return true;
})()`);

const finishRecorder = async (client) => {
  await client.evaluate('window.__dyutRecorder.recorder.stop(); true');
  await waitFor(() => client.evaluate('Boolean(window.__dyutVideo)'), 'video encoding', 30000);
  return client.evaluate('window.__dyutVideo');
};

const record = async (gameClient, encoderClient, name, width, height) => {
  await gameClient.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await beginRecorder(encoderClient, width, height);
  for (let frame = 0; frame < 64; frame += 1) {
    if ([7, 22, 38, 53].includes(frame)) await gameClient.evaluate('document.querySelector("#dice-roll-btn:not([disabled])")?.click(); true');
    const screenshot = await gameClient.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await addFrame(encoderClient, screenshot.data);
    await sleep(250);
  }
  const base64 = await finishRecorder(encoderClient);
  const destination = path.join(OUTPUT, `dyut-preview-${name}.mp4`);
  await fs.writeFile(destination, Buffer.from(base64, 'base64'));
  return destination;
};

let vite; let chrome; let gameClient; let encoderClient;
try {
  await fs.mkdir(OUTPUT, { recursive: true });
  vite = await startVite(); chrome = await startChrome();
  gameClient = await createClient(chrome.endpoint);
  const encoderTarget = await (await fetch(`${chrome.endpoint}/json/new?about:blank`, { method: 'PUT' })).json();
  encoderClient = await createClient(chrome.endpoint, encoderTarget.webSocketDebuggerUrl);
  await openGame(gameClient, vite.url, 1920, 1080);
  const landscape = await record(gameClient, encoderClient, 'landscape-1920x1080', 1920, 1080);
  await openGame(gameClient, vite.url, 1080, 1620);
  const portrait = await record(gameClient, encoderClient, 'portrait-1080x1620', 1080, 1620);
  console.log(`Created ${landscape}`); console.log(`Created ${portrait}`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  gameClient?.socket.close(); encoderClient?.socket.close();
  if (chrome?.processHandle && !chrome.processHandle.killed) chrome.processHandle.kill();
  if (vite?.processHandle && !vite.processHandle.killed) vite.processHandle.kill();
  await fs.rm(PROFILE, { recursive: true, force: true }).catch(() => {});
}

const endpoint = 'http://127.0.0.1:5001/onlinedyut/asia-south1/health';
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ data: {} }),
});
const payload = await response.json();
const result = payload?.data || payload?.result;

if (!response.ok || result?.ok !== true || result?.generation !== 2) {
  throw new Error(`Functions health check failed: ${JSON.stringify(payload)}`);
}

console.log(`Functions health check passed (generation ${result.generation}).`);

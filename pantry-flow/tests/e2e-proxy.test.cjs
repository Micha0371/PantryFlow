const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { fork } = require('node:child_process');

// Drives the real test proxy against a stub upstream on free ports, so a running
// local stack on 54321/54329 is never touched.
async function start({ upstreamUp = true } = {}) {
  const seen = [];
  const upstream = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = upstream.address().port;
  // An upstream that drops every connection stands in for an unreachable one,
  // without relying on a closed port staying free (KAN-86).
  if (!upstreamUp) upstream.on('connection', socket => socket.destroy());
  const proxy = fork(path.join(__dirname, '../scripts/e2e-proxy.cjs'), [], {
    env: { ...process.env, PANTRY_PROXY_PORT: '0', PANTRY_PROXY_UPSTREAM_PORT: String(upstreamPort) },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const port = await new Promise((resolve, reject) => {
    proxy.once('message', message => resolve(message.port));
    proxy.once('exit', code => reject(Error(`proxy exited ${code}`)));
  });
  const send = (method, url, body) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end(method === 'GET' ? undefined : body ?? '{}');
  });
  const call = async (method, url) => (await send(method, url)).status;
  const stop = () => { proxy.kill(); upstream.close(); };
  return { call, send, seen, stop };
}

const shopping = '/rest/v1/pantry_shopping_items?select=*';
const pantry = '/rest/v1/pantry_items?select=*';

test('the shopping read fault fails only shopping reads until restore', async () => {
  const { call, seen, stop } = await start();
  try {
    assert.equal(await call('GET', '/__test/fail-shopping-reads'), 200);
    assert.equal(await call('GET', shopping), 503);
    assert.equal(await call('GET', pantry), 200);
    assert.equal(await call('POST', shopping), 200);
    assert.equal(await call('PATCH', shopping), 200);
    assert.equal(await call('GET', '/__test/restore'), 200);
    assert.equal(await call('GET', shopping), 200);
    assert.deepEqual(seen, [`GET ${pantry}`, `POST ${shopping}`, `PATCH ${shopping}`, `GET ${shopping}`]);
  } finally { stop(); }
});

test('the pantry read fault still leaves shopping reads alone', async () => {
  const { call, stop } = await start();
  try {
    await call('GET', '/__test/fail-reads');
    assert.equal(await call('GET', pantry), 503);
    assert.equal(await call('GET', shopping), 200);
    await call('GET', '/__test/restore');
    assert.equal(await call('GET', pantry), 200);
  } finally { stop(); }
});

// KAN-27: pins the control, PKCE, delayed-write and upstream-failure paths before splitting the handler.
test('control endpoints answer with the write state', async () => {
  const { send, stop } = await start();
  try {
    assert.deepEqual(await send('GET', '/__test/restore'), { status: 200, body: '{"pendingWrites":0,"writeStarted":false}' });
  } finally { stop(); }
});

test('signup and resend without S256 PKCE are refused and not forwarded', async () => {
  const { send, seen, stop } = await start();
  try {
    for (const url of ['/auth/v1/signup', '/auth/v1/resend']) {
      for (const body of ['{}', 'not json', '{"code_challenge_method":"plain"}']) {
        const reply = await send('POST', url, body);
        assert.equal(reply.status, 400);
        assert.match(reply.body, /requires S256 PKCE/);
      }
      assert.equal((await send('POST', url, '{"code_challenge_method":"s256"}')).status, 200);
    }
    assert.deepEqual(seen, ['POST /auth/v1/signup', 'POST /auth/v1/resend']);
  } finally { stop(); }
});

test('a delayed pantry write is held and reported, and other writes pass', async () => {
  const { call, send, seen, stop } = await start();
  try {
    await call('GET', '/__test/delay-write');
    assert.equal(await call('PATCH', shopping), 200);
    assert.equal(await call('POST', pantry), 200);
    send('PATCH', pantry).catch(() => {});
    let state = { writeStarted: false };
    for (let i = 0; i < 40 && !state.writeStarted; i++) state = JSON.parse((await send('GET', '/__test/wait-write')).body);
    assert.deepEqual(state, { pendingWrites: 1, writeStarted: true });
    assert.deepEqual(seen, [`PATCH ${shopping}`, `POST ${pantry}`]);
  } finally { stop(); }
});

test('an upstream that drops the connection answers 502', async () => {
  const { send, stop } = await start({ upstreamUp: false });
  try {
    assert.deepEqual(await send('GET', pantry), { status: 502, body: 'Local Supabase unavailable' });
  } finally { stop(); }
});

// KAN-127: data requests end after 20 s without an answer. The delayed write models a slow save
// that still answers (slice-1-1's abandoned-save check leaves the screen while it is pending), so
// it must answer well before that timeout; a longer delay would turn it into an unconfirmed write.
test('the delayed write answers well before the app\'s data timeout', () => {
  const fs = require('node:fs');
  const { load } = require('./helpers.cjs');
  const { DATA_REQUEST_TIMEOUT_MS } = load('lib/auth-timeout.ts');
  const source = fs.readFileSync(path.join(__dirname, '../scripts/e2e-proxy.cjs'), 'utf8');
  const delays = [...source.matchAll(/if \(delayed\) \{[^}]*await sleep\((\d+)\)/g)].map(m => Number(m[1]));
  assert.equal(delays.length, 1, 'exactly one delayed-write sleep in the proxy');
  assert.ok(delays[0] <= DATA_REQUEST_TIMEOUT_MS - 5000, `delay ${delays[0]} ms leaves under 5 s before the ${DATA_REQUEST_TIMEOUT_MS} ms data timeout`);
  assert.ok(delays[0] >= 10000, `delay ${delays[0]} ms is too short for the flow to leave the screen while the save is pending`);
});

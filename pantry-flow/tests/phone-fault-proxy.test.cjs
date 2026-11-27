const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { fork } = require('node:child_process');

// KAN-127 phone check (DATA-TO-PHONE): the phone-session proxy forwards to the local stack like the
// e2e proxy, but can leave data requests unanswered. Driven here against a stub upstream on free
// ports, so a running local stack on 54321/54329 is never touched.
const NO_ANSWER_MS = 300;

async function start() {
  const seen = [];
  const upstream = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    req.resume();
    req.on('end', () => {
      res.writeHead(req.method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' });
      res.end('[]');
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const proxy = fork(path.join(__dirname, '../scripts/phone-fault-proxy.cjs'), [], {
    env: { ...process.env, PANTRY_PROXY_PORT: '0', PANTRY_PROXY_UPSTREAM_PORT: String(upstream.address().port) },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  // A proxy that fails to start must end the test with a named failure, not keep the stub open.
  const port = await new Promise((resolve, reject) => {
    proxy.once('message', message => resolve(message.port));
    proxy.once('exit', code => reject(Error(`proxy exited ${code}`)));
  }).catch(error => { upstream.close(); throw error; });
  const open = new Set();
  // Resolves with the answer, or with 'no answer' when none arrives in time (the request is then
  // left open, as the phone's would be), or with 'closed' when the proxy drops the connection.
  const send = (method, url) => new Promise(resolve => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, method, agent: false }, res => {
      clearTimeout(timer);
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    const timer = setTimeout(() => resolve('no answer'), NO_ANSWER_MS);
    req.on('error', () => { clearTimeout(timer); resolve('closed'); });
    req.on('close', () => open.delete(req));
    open.add(req);
    // Like supabase-js: a body only on POST and PATCH (Node's parser refuses a DELETE with one).
    req.end(method === 'POST' || method === 'PATCH' ? '{}' : undefined);
  });
  const state = async () => JSON.parse((await send('GET', '/__test/state')).body);
  const stop = () => { for (const req of open) req.destroy(); proxy.kill(); upstream.close(); };
  // A request kept open until the proxy answers, drops it, or `ms` pass.
  const watch = (url, ms = 2000) => {
    let req;
    const outcome = new Promise(resolve => {
      req = http.request({ hostname: '127.0.0.1', port, path: url, method: 'GET', agent: false }, () => resolve('answered'));
      req.on('error', () => resolve('dropped'));
      req.end();
    });
    open.add(req);
    return { result: () => Promise.race([outcome, new Promise(resolve => setTimeout(() => resolve('still open'), ms))]) };
  };
  return { send, state, watch, seen, stop };
}

const pantryRead = '/rest/v1/pantry_items?select=*';
const pantryWrite = '/rest/v1/pantry_items';
const shoppingWrite = '/rest/v1/pantry_shopping_items';
const authCall = '/auth/v1/user';

test('without a fault, every request is forwarded and answered', async () => {
  const p = await start();
  try {
    assert.equal((await p.send('GET', pantryRead)).status, 200);
    assert.equal((await p.send('POST', pantryWrite)).status, 201);
    assert.equal((await p.send('GET', authCall)).status, 200);
    assert.deepEqual(p.seen, [`GET ${pantryRead}`, `POST ${pantryWrite}`, `GET ${authCall}`]);
  } finally { p.stop(); }
});

test('hang-reads leaves data reads unanswered, still answers writes and Auth, and restore drops the held reads', async () => {
  const p = await start();
  try {
    assert.equal((await p.send('GET', '/__test/hang-reads')).status, 200);
    const held = p.send('GET', pantryRead);
    assert.equal(await held, 'no answer', 'a data read gets no answer');
    assert.equal((await p.send('POST', shoppingWrite)).status, 201, 'writes are still answered');
    assert.equal((await p.send('GET', authCall)).status, 200, 'Auth is still answered');
    assert.deepEqual(p.seen, [`POST ${shoppingWrite}`, `GET ${authCall}`], 'the held read never reached the stack');
    const watched = p.watch(pantryRead);
    let during;
    for (let i = 0; i < 20 && (during = await p.state()).held < 2; i++);
    assert.equal(during.hangReads, true);
    assert.equal(during.held, 2);
    assert.equal((await p.send('GET', '/__test/restore')).status, 200);
    assert.equal(await watched.result(), 'dropped', 'restore drops a held request instead of leaving it open');
    const after = await p.state();
    assert.equal(after.hangReads, false);
    assert.equal(after.held, 0, 'restore drops the held requests');
    assert.equal((await p.send('GET', pantryRead)).status, 200, 'reads are answered again');
  } finally { p.stop(); }
});

test('hang-reads?table= leaves only that table\'s reads unanswered', async () => {
  const p = await start();
  try {
    assert.equal((await p.send('GET', '/__test/hang-reads?table=pantry_items')).status, 200);
    assert.equal(await p.send('GET', pantryRead), 'no answer', 'the named table\'s read gets no answer');
    const household = '/rest/v1/pantry_household_members?select=household_id';
    assert.equal((await p.send('GET', household)).status, 200, 'another table\'s read is answered');
    assert.equal((await p.send('GET', '/rest/v1/pantry_items_archive?select=*')).status, 200, 'a table that only starts with the name is answered');
    assert.equal((await p.state()).hangReads, 'pantry_items');
  } finally { p.stop(); }
});

test('hang-writes leaves data writes unanswered and unsent, still answers reads', async () => {
  const p = await start();
  try {
    await p.send('GET', '/__test/hang-writes');
    assert.equal(await p.send('POST', pantryWrite), 'no answer');
    assert.equal(await p.send('PATCH', pantryWrite), 'no answer');
    assert.equal(await p.send('DELETE', shoppingWrite), 'no answer');
    assert.equal((await p.send('GET', pantryRead)).status, 200, 'reads are still answered');
    assert.deepEqual(p.seen, [`GET ${pantryRead}`], 'no held write reached the stack, so none was committed');
    const s = await p.state();
    assert.equal(s.held, 3);
    assert.deepEqual(s.swallowedWrites, []);
  } finally { p.stop(); }
});

test('swallow-writes sends the write to the stack but never answers the app, and records the stack\'s status', async () => {
  const p = await start();
  try {
    await p.send('GET', '/__test/swallow-writes');
    assert.equal(await p.send('POST', shoppingWrite), 'no answer', 'the app gets no answer');
    assert.deepEqual(p.seen, [`POST ${shoppingWrite}`], 'the write reached the stack');
    const s = await p.state();
    assert.deepEqual(s.swallowedWrites, [{ method: 'POST', table: 'pantry_shopping_items', status: 201 }], 'the stack answered 201: committed');
    assert.equal(s.held, 1);
    assert.equal(s.hangWrites, false);
    assert.equal((await p.send('GET', pantryRead)).status, 200, 'reads are still answered');
  } finally { p.stop(); }
});

test('hang-reads combined with swallow-writes: the write commits, and the re-read after it gets no answer', async () => {
  const p = await start();
  try {
    await p.send('GET', '/__test/swallow-writes');
    await p.send('GET', '/__test/hang-reads');
    assert.equal(await p.send('POST', pantryWrite), 'no answer');
    assert.equal(await p.send('GET', pantryRead), 'no answer');
    assert.deepEqual(p.seen, [`POST ${pantryWrite}`]);
    const s = await p.state();
    assert.equal(s.hangReads, true);
    assert.equal(s.swallowWrites, true);
    assert.equal(s.held, 2);
  } finally { p.stop(); }
});

test('an unknown control is refused and changes nothing', async () => {
  const p = await start();
  try {
    assert.equal((await p.send('GET', '/__test/hang-everything')).status, 404);
    const s = await p.state();
    assert.equal(s.hangReads || s.hangWrites || s.swallowWrites, false);
    assert.equal((await p.send('GET', pantryRead)).status, 200);
  } finally { p.stop(); }
});

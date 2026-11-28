// Phone-session only (KAN-127, DATA-TO-PHONE): forwards to the local stack like the e2e proxy, but
// can leave data requests (/rest/v1/) unanswered, the way a connection that opens and never answers
// does. Never loaded by the e2e runs. Local only: binds 127.0.0.1; no hosted URLs, tokens or data.
//   /__test/hang-reads      data reads get no answer and never reach the stack
//   /__test/hang-reads?table=pantry_items   only that table's reads (the household read still answers)
//   /__test/hang-writes     data writes get no answer and never reach the stack (not committed)
//   /__test/swallow-writes  data writes reach the stack, the app gets no answer (committed, answer lost)
//   /__test/restore         everything answered again; held requests are dropped
//   /__test/state           the switches, the held count and each swallowed write's stack status
// Auth (/auth/v1/) is always forwarded, so sign-in and token refresh keep working. Only /auth/v1/ and
// /rest/v1/ paths are forwarded, and only the response headers the app reads are passed back.
const http = require('node:http');
// Port overrides exist only for the proxy's unit test; the phone session uses the defaults.
const listenPort = Number(process.env.PANTRY_PROXY_PORT ?? 54329);
const upstreamPort = Number(process.env.PANTRY_PROXY_UPSTREAM_PORT ?? 54321);
const WRITES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const modes = { hangReads: false, hangWrites: false, swallowWrites: false };
const held = new Set();
let swallowedWrites = [];

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};
const state = () => ({ ...modes, held: held.size, swallowedWrites });

function hold(req, res) {
  held.add(res);
  req.on('close', () => held.delete(res));
}

const tableOf = url => url.slice('/rest/v1/'.length).split('?')[0];

// Only Auth and data requests are forwarded, never with a ".." segment (also percent-encoded).
function forwardable(url) {
  if (!/^\/(?:auth|rest)\/v1\//.test(url)) return false;
  let route;
  try { route = decodeURIComponent(url.split('?')[0]); } catch { return false; }
  return !route.split('/').includes('..');
}

// Only the response headers the app reads go back; never a redirect or a cookie from upstream.
const ANSWER_HEADERS = ['content-type', 'content-length', 'content-encoding', 'content-range', 'preference-applied',
  'x-supabase-api-version', 'retry-after'];
function answerHeaders(headers) {
  const out = {};
  for (const name of ANSWER_HEADERS) if (headers[name] !== undefined) out[name] = headers[name];
  return out;
}

function control(req, res) {
  const [route, query = ''] = req.url.split('?');
  const name = route.slice('/__test/'.length);
  if (name === 'hang-reads') modes.hangReads = new URLSearchParams(query).get('table') || true;
  else if (name === 'hang-writes') { modes.hangWrites = true; modes.swallowWrites = false; }
  else if (name === 'swallow-writes') { modes.swallowWrites = true; modes.hangWrites = false; }
  else if (name === 'restore') {
    Object.keys(modes).forEach(key => { modes[key] = false; });
    for (const res of held) res.destroy();
    held.clear();
    swallowedWrites = [];
  } else if (name !== 'state') return json(res, 404, { message: `unknown control ${name}` });
  json(res, 200, state());
}

function forward(req, res, body, swallow) {
  const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${upstreamPort}` } }, response => {
    if (!swallow) {
      res.writeHead(response.statusCode, answerHeaders(response.headers));
      return response.pipe(res);
    }
    // Committed or not, the stack's answer is recorded (table and status only) and never sent.
    response.resume();
    swallowedWrites.push({ method: req.method, table: tableOf(req.url), status: response.statusCode });
  });
  upstream.on('error', () => { if (!swallow) { res.writeHead(502); res.end('Local Supabase unavailable'); } });
  upstream.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/__test/')) return control(req, res);
  if (!forwardable(req.url)) return json(res, 404, { message: 'not forwarded by the phone fault proxy' });
  const data = req.url.startsWith('/rest/v1/');
  const write = WRITES.has(req.method);
  if (data && !write && (modes.hangReads === true || modes.hangReads === tableOf(req.url))) return hold(req, res);
  if (data && write && modes.hangWrites) return hold(req, res);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const swallow = data && write && modes.swallowWrites;
  if (swallow) hold(req, res);
  forward(req, res, Buffer.concat(chunks), swallow);
});
server.listen(listenPort, '127.0.0.1', () => {
  process.send?.({ ready: true, port: server.address().port });
  if (!process.send) console.log(`phone fault proxy on 127.0.0.1:${server.address().port} -> 127.0.0.1:${upstreamPort}`);
});
process.on('SIGTERM', () => server.close(() => process.exit()));

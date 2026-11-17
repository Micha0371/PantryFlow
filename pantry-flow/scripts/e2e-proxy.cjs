// Local test-only transport: real Auth/PostgREST with controllable pantry faults.
// No production imports, hosted URLs, tokens, or database bypass.
const http = require('node:http');
// Port overrides exist only for the proxy's own unit test; e2e runs use the defaults.
const listenPort = Number(process.env.PANTRY_PROXY_PORT ?? 54329);
const upstreamPort = Number(process.env.PANTRY_PROXY_UPSTREAM_PORT ?? 54321);
let failReads = false;
let failShoppingReads = false;
let delayWrites = false;
let pendingWrites = 0;
let writeStarted = false;

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// /__test/* switches faults on and off and reports the delayed-write state.
async function control(req, res) {
  if (req.url === '/__test/fail-reads') failReads = true;
  else if (req.url === '/__test/fail-shopping-reads') failShoppingReads = true;
  else if (req.url === '/__test/restore') { failReads = false; failShoppingReads = false; delayWrites = false; }
  else if (req.url === '/__test/delay-write') { delayWrites = true; writeStarted = false; }
  else if (req.url === '/__test/wait-write') await sleep(500);
  json(res, 200, { pendingWrites, writeStarted });
}

// The message for an active read fault on this request, if any.
function readFault(req) {
  if (req.method !== 'GET') return null;
  if (failReads && req.url.startsWith('/rest/v1/pantry_items')) return 'Intentional local pantry read failure';
  if (failShoppingReads && req.url.startsWith('/rest/v1/pantry_shopping_items')) return 'Intentional local shopping read failure';
  return null;
}

// Signup and resend must carry S256 PKCE, as the native app sends it.
function lacksPkce(req, body) {
  if (!req.url.startsWith('/auth/v1/signup') && !req.url.startsWith('/auth/v1/resend')) return false;
  let payload;
  try { payload = JSON.parse(body.toString()); } catch { payload = {}; }
  return payload.code_challenge_method !== 's256';
}

function forward(req, res, body, delayed) {
  const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${upstreamPort}` } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
    response.on('end', () => {
      if (delayed) pendingWrites--;
    });
  });
  upstream.on('error', () => { res.writeHead(502); res.end('Local Supabase unavailable'); });
  upstream.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/__test/')) return control(req, res);
  const fault = readFault(req);
  if (fault) return json(res, 503, { message: fault });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (lacksPkce(req, body)) return json(res, 400, { message: 'Native confirmation test requires S256 PKCE' });
  const delayed = delayWrites && req.url.startsWith('/rest/v1/pantry_items') && req.method === 'PATCH';
  if (delayed) { writeStarted = true; pendingWrites++; await sleep(30000); }
  forward(req, res, body, delayed);
});
server.listen(listenPort, '127.0.0.1', () => process.send?.({ ready: true, port: server.address().port }));
process.on('SIGTERM', () => server.close(() => process.exit()));

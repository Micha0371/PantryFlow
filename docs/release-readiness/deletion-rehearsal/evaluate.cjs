'use strict';
// Compares the before and after outputs of readback.sql for the populated-account deletion rehearsal.
//
//   node evaluate.cjs --before-only before.json   (preconditions only)
//   node evaluate.cjs before.json after.json
//
// Each file is the JSON array of rows { entity, scope, value } that readback.sql returns (a wrapping object
// is accepted too). Prints one line per rule and a verdict, with these exit codes:
//   READY 0  preconditions hold (--before-only)
//   PASS  0  the deletion did what the protocol expects
//   FAIL  1  it did not; see the FAIL lines
//   STOP  2  a precondition failed: do not delete
//   ERROR 2  the input is unusable (missing or duplicate rows, no rows)
const fs = require('node:fs');

// Target records the deletion must remove. The before value of each is printed, so a PASS on empty data shows.
const TARGET_GONE = ['auth.users', 'auth.identities', 'auth.sessions', 'auth.refresh_tokens', 'auth.mfa_factors',
  'auth.one_time_tokens', 'public.profiles', 'public.pantry_households', 'public.pantry_household_members',
  'public.pantry_items', 'public.pantry_shopping_items', 'fixture.pantry_item', 'fixture.linked_shopping',
  'fixture.manual_shopping', 'fixture.completed_shopping', 'fixture.fixture_rows_anywhere'];
// Recorded only: flow states have no foreign key; hosted is not expected to store audit entries (FV-A1).
const TARGET_RECORDED = ['auth.flow_state', 'auth.audit_log_entries'];
const BEFORE_EXACT = {
  'auth.users': 1, 'public.profiles': 1, 'public.pantry_households': 1, 'public.pantry_household_members': 1,
  'precondition.distinct_accounts': 1, 'precondition.target_household_members': 1, 'precondition.target_memberships': 1,
  'fixture.pantry_item': 1, 'fixture.linked_shopping': 1, 'fixture.manual_shopping': 1,
  'fixture.completed_shopping': 1, 'fixture.fixture_rows_anywhere': 4, attributed_elsewhere: 0,
};
const BEFORE_AT_LEAST = { 'auth.identities': 1, 'public.pantry_items': 1, 'public.pantry_shopping_items': 3 };
const OTHER_EXACT = { 'auth.users': 1, 'public.profiles': 1, 'public.pantry_households': 1, 'public.pantry_household_members': 1 };
const OTHER_AT_LEAST = { 'auth.identities': 1, 'public.pantry_items': 1, 'public.pantry_shopping_items': 1 };

// Accepts a plain array of rows or an object that wraps one (for example { rows: [...] }); the Supabase
// CLI's exact JSON shape for this query has not been checked against the hosted project.
function rowsOf(data) {
  if (Array.isArray(data)) return data.some(row => row && 'entity' in row) ? data : data.flatMap(rowsOf);
  if (data && typeof data === 'object') return Object.values(data).flatMap(value => (typeof value === 'object' ? rowsOf(value) : []));
  return [];
}

function index(data) {
  const rows = rowsOf(data);
  if (rows.length === 0) throw new Error('no read-back rows found');
  const map = new Map();
  for (const row of rows) {
    const key = `${row.entity}|${row.scope}`;
    if (map.has(key)) throw new Error(`duplicate row ${key}`);
    map.set(key, String(row.value));
  }
  return map;
}

function get(map, entity, scope) {
  const value = map.get(`${entity}|${scope}`);
  if (value === undefined) throw new Error(`missing row ${entity}|${scope}`);
  return value;
}

function preconditions(before, rule) {
  for (const [entity, n] of Object.entries(BEFORE_EXACT)) {
    const value = Number(get(before, entity, 'target'));
    rule('pre', value === n, `before: target ${entity} = ${n} (is ${value})`);
  }
  for (const [entity, n] of Object.entries(BEFORE_AT_LEAST)) {
    const value = Number(get(before, entity, 'target'));
    rule('pre', value >= n, `before: target ${entity} >= ${n} (is ${value})`);
  }
  for (const [entity, n] of Object.entries(OTHER_EXACT)) {
    const value = Number(get(before, entity, 'other'));
    rule('pre', value === n, `before: other ${entity} = ${n} (is ${value})`);
  }
  for (const [entity, n] of Object.entries(OTHER_AT_LEAST)) {
    const value = Number(get(before, entity, 'other'));
    rule('pre', value >= n, `before: other ${entity} >= ${n} (is ${value})`);
  }
}

function postconditions(before, after, rule, lines) {
  for (const entity of TARGET_GONE) {
    const was = get(before, entity, 'target');
    const value = Number(get(after, entity, 'target'));
    rule('post', value === 0, `after: target ${entity} = 0 (is ${value}; was ${was})`);
  }
  for (const [key, value] of before) {
    const [entity, scope] = key.split('|');
    if (scope === 'target') continue;
    const now = get(after, entity, scope);
    rule('post', now === value, `after: ${scope} ${entity} unchanged (${scope.endsWith('digest') ? 'hash' : `${value} -> ${now}`})`);
  }
  for (const entity of TARGET_RECORDED) {
    lines.push(`info target ${entity}: ${get(before, entity, 'target')} before, ${get(after, entity, 'target')} after`);
  }
}

// afterRows null: preconditions only (READY or STOP).
function evaluate(beforeRows, afterRows) {
  const before = index(beforeRows);
  const after = afterRows === null ? null : index(afterRows);
  const lines = [];
  let stop = false;
  let fail = false;
  const rule = (kind, ok, text) => {
    lines.push(`${ok ? 'ok  ' : kind === 'pre' ? 'STOP' : 'FAIL'} ${text}`);
    if (!ok && kind === 'pre') stop = true;
    if (!ok && kind === 'post') fail = true;
  };
  preconditions(before, rule);
  if (after === null) return { verdict: stop ? 'STOP' : 'READY', lines };
  postconditions(before, after, rule, lines);
  return { verdict: stop ? 'STOP' : fail ? 'FAIL' : 'PASS', lines };
}

function main() {
  const args = process.argv.slice(2);
  const beforeOnly = args[0] === '--before-only';
  const [beforeFile, afterFile] = beforeOnly ? args.slice(1) : args;
  if (!beforeFile || (!beforeOnly && !afterFile)) throw new Error('usage: node evaluate.cjs [--before-only] before.json [after.json]');
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const { verdict, lines } = evaluate(read(beforeFile), beforeOnly ? null : read(afterFile));
  for (const line of lines) console.log(line);
  console.log(`VERDICT ${verdict}`);
  process.exitCode = { PASS: 0, READY: 0, FAIL: 1, STOP: 2 }[verdict];
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 2; }
}
module.exports = { evaluate };

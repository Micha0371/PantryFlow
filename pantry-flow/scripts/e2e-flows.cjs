// The e2e flows, kept free of side effects so the selection can be unit-tested without Maestro or a stack.
// The flows in run order: each has its own seed (seed:<name>) and verify (verify:<name>).
// slice-1-1 keeps its historical report names (results.xml, debug/).
const FLOWS = [
  { name: 'slice-1-1', file: 'slice-1-1', xml: 'results.xml', debug: 'debug' },
  { name: 'slice-2-shopping', file: 'slice-2-shopping', xml: 'slice-2-shopping.xml', debug: 'slice-2-shopping' },
  { name: 'slice-3-status', file: 'slice-3-status', xml: 'slice-3-status.xml', debug: 'slice-3-status' },
  { name: 'slice-3-search', file: 'slice-3-search', xml: 'slice-3-search.xml', debug: 'slice-3-search' },
  { name: 'slice-3-entry', file: 'slice-3-entry', xml: 'slice-3-entry.xml', debug: 'slice-3-entry' },
  // One test: the PKCE link only opens in the app that registered, so it cannot be split.
  { name: 'confirmation', file: 'confirmation-register', xml: 'confirmation-register.xml', debug: 'confirmation-register' },
];

// The Maestro files the confirmation flow runs as one unit (run-e2e.cjs starts them by these names).
const CONFIRMATION_FILES = { register: 'confirmation-register', complete: 'confirmation-complete', resend: 'confirmation-resend' };

// Every Maestro file the runner starts, each once.
function flowFiles() {
  return [...new Set([...FLOWS.map(flow => flow.file), ...Object.values(CONFIRMATION_FILES)])];
}

// Pure: no --flow runs every flow in order; --flow <name> runs exactly that one.
// Anything else is an error: npm swallows `--flow x` into npm's own config and passes only `x`
// on, which must not silently run every flow.
function selectFlows(argv) {
  let chosen;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg !== '--flow' && !arg.startsWith('--flow=')) {
      throw new Error(`Unexpected argument "${arg}"; usage: node scripts/run-e2e.cjs [--flow <name>] (with npm: npm run test:e2e -- --flow <name>)`);
    }
    if (chosen) throw new Error('--flow was given more than once; name exactly one flow');
    const name = arg === '--flow' ? argv[++i] : arg.slice('--flow='.length);
    chosen = FLOWS.find(candidate => candidate.name === name);
    if (!chosen) {
      const shown = name === undefined || name.startsWith('--') ? '(none given)' : `"${name}"`;
      throw new Error(`Unknown flow ${shown}; valid flows: ${FLOWS.map(f => f.name).join(', ')}`);
    }
  }
  return chosen ? [chosen] : FLOWS;
}
module.exports = { FLOWS, CONFIRMATION_FILES, selectFlows, flowFiles };

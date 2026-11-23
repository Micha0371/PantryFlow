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

// Pure: no --flow runs every flow in order; --flow <name> runs exactly that one.
function selectFlows(argv) {
  const at = argv.indexOf('--flow');
  const inline = argv.find(arg => arg.startsWith('--flow='));
  if (at === -1 && inline === undefined) return FLOWS;
  const name = inline !== undefined ? inline.slice('--flow='.length) : argv[at + 1];
  const flow = FLOWS.find(candidate => candidate.name === name);
  if (!flow) throw new Error(`Unknown flow ${name === undefined || name.startsWith('--') ? '(none given)' : `"${name}"`}; valid flows: ${FLOWS.map(f => f.name).join(', ')}`);
  return [flow];
}
module.exports = { FLOWS, selectFlows };

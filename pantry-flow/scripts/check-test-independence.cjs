'use strict';
// Static test-independence check (KAN-121 TEST-04). Parses test sources with the
// TypeScript compiler API, so strings and comments are never matched as code.
// A finding can be waived on its line (or the line above) with
// `// independence-ok: <reason>`; the reason is required and is printed.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const TEST_NAMES = new Set(['test', 'it', 'fit']);
const SUITE_NAMES = new Set(['describe', 'suite', 'fdescribe']);
const MODIFIERS = new Set(['only', 'skip', 'todo']);
const HOOKS = new Set(['after', 'afterEach', 'afterAll']);
const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill',
  'copyWithin', 'set', 'delete', 'clear', 'add']);
const CONTAINERS = new Set(['Array', 'Map', 'Set', 'WeakMap', 'WeakSet']);
const INVISIBLE = /[\u00A0\u00AD\u2000-\u200F\u2028\u2029\u202F\u205F-\u2064\u3000\uFEFF]/g;
const EXEMPT = /\/\/\s*independence-ok:(.*)$/;

const KINDS = { '.cjs': ts.ScriptKind.JS, '.js': ts.ScriptKind.JS, '.jsx': ts.ScriptKind.JSX,
  '.ts': ts.ScriptKind.TS, '.tsx': ts.ScriptKind.TSX };
const scriptKindFor = file => KINDS[path.extname(file)] ?? ts.ScriptKind.TS;

const isFn = n => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n)
  || ts.isMethodDeclaration(n);
const unwrap = n => (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)
  || ts.isSatisfiesExpression(n)) ? unwrap(n.expression) : n;
const inside = (node, outer) => node.pos >= outer.pos && node.end <= outer.end;

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}

function lastFunctionArg(call) {
  const fn = call.arguments[call.arguments.length - 1];
  return fn && isFn(fn) ? fn : null;
}

// test('x', fn), it(...), t.test(...), test.only/skip/todo(...), test.each(rows)('x', fn)
function testCallback(call) {
  let callee = call.expression;
  if (ts.isCallExpression(callee) && ts.isPropertyAccessExpression(callee.expression)
    && callee.expression.name.text === 'each') callee = callee.expression.expression;
  let ok = false;
  if (ts.isIdentifier(callee)) ok = TEST_NAMES.has(callee.text);
  else if (ts.isPropertyAccessExpression(callee)) {
    const name = callee.name.text;
    ok = name === 'test' || name === 'it'
      || (MODIFIERS.has(name) && ts.isIdentifier(callee.expression) && TEST_NAMES.has(callee.expression.text));
  }
  return ok ? lastFunctionArg(call) : null;
}

function suiteCallback(call) {
  let callee = call.expression;
  if (ts.isPropertyAccessExpression(callee) && MODIFIERS.has(callee.name.text)) callee = callee.expression;
  return ts.isIdentifier(callee) && SUITE_NAMES.has(callee.text) ? lastFunctionArg(call) : null;
}

function hookCallback(call) {
  const callee = call.expression;
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
  return HOOKS.has(name) ? lastFunctionArg(call) : null;
}

function bindingNames(name, out = []) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, out);
  return out;
}

// Finds the declaration an identifier refers to. `fileLevel` is true for bindings declared at the
// top of the file or directly in a describe body (shared by every test in it).
function resolve(id, suites) {
  const name = id.text;
  for (let p = id.parent; p; p = p.parent) {
    let found = null;
    if (isFn(p)) {
      if (p.parameters.some(par => bindingNames(par.name).includes(name))) return { decl: null };
    } else if (ts.isCatchClause(p)) {
      if (p.variableDeclaration && bindingNames(p.variableDeclaration.name).includes(name)) return { decl: null };
    } else if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p))
      && p.initializer && ts.isVariableDeclarationList(p.initializer)) {
      found = p.initializer.declarations.find(d => bindingNames(d.name).includes(name));
    } else if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) {
      for (const st of p.statements) {
        if (ts.isVariableStatement(st)) found = st.declarationList.declarations.find(d => bindingNames(d.name).includes(name));
        else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name) return { decl: null };
        else if (ts.isImportDeclaration(st) || ts.isImportEqualsDeclaration(st)) continue;
        if (found) break;
      }
    }
    if (found) {
      const scope = p;
      const fileLevel = ts.isSourceFile(scope) || (ts.isBlock(scope) && suites.has(scope.parent));
      return { decl: found, fileLevel, isConst: !!(found.parent.flags & ts.NodeFlags.Const) };
    }
  }
  return { decl: null };
}

const rootIdentifier = expr => {
  let e = unwrap(expr);
  while (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) e = unwrap(e.expression);
  return ts.isIdentifier(e) ? e : null;
};

const isContainer = init => {
  if (!init) return false;
  const e = unwrap(init);
  return ts.isArrayLiteralExpression(e) || ts.isObjectLiteralExpression(e)
    || (ts.isNewExpression(e) && ts.isIdentifier(e.expression) && CONTAINERS.has(e.expression.text));
};

const isAssignment = n => ts.isBinaryExpression(n)
  && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
const isIncDec = n => (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n))
  && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken);

// The property a write targets, e.g. "global.fetch" or "process.env.LOCALE"; null for anything else.
function globalKey(target) {
  const e = unwrap(target);
  if (!ts.isPropertyAccessExpression(e) && !ts.isElementAccessExpression(e)) return null;
  const prop = ts.isPropertyAccessExpression(e) ? e.name.text
    : (ts.isStringLiteralLike(e.argumentExpression) ? e.argumentExpression.text : '*');
  const obj = unwrap(e.expression);
  if (ts.isIdentifier(obj) && (obj.text === 'global' || obj.text === 'globalThis')) return `global.${prop}`;
  if (ts.isPropertyAccessExpression(obj) && ts.isIdentifier(obj.expression) && obj.expression.text === 'process'
    && obj.name.text === 'env') return `process.env.${prop}`;
  return null;
}

// A write to a global-ish property: assignment or delete. Returns { node, key } or null.
function globalWrite(node) {
  if (isAssignment(node)) {
    const left = unwrap(node.left);
    if (ts.isPropertyAccessExpression(left) && left.name.text === 'env' && ts.isIdentifier(left.expression)
      && left.expression.text === 'process') return { node, key: 'process.env' };
    const key = globalKey(left);
    return key && { node, key };
  }
  if (ts.isDeleteExpression(node)) {
    const key = globalKey(node.expression);
    return key && { node, key };
  }
  return null;
}

const dotted = n => ts.isIdentifier(n) ? n.text
  : ts.isPropertyAccessExpression(n) ? `${dotted(n.expression)}.${n.name.text}` : '?';

function analyze(files) {
  const violations = [];
  const exemptions = [];
  for (const { path: file, text } of files) analyzeFile(file, text, violations, exemptions);
  return { violations, exemptions };
}

function analyzeFile(file, text, violations, exemptions) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const found = [];
  const lineOf = pos => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const add = (pos, rule, detail) => found.push({ path: file, line: lineOf(pos), rule, detail });

  // Collect structure once.
  const tests = new Set();
  const suites = new Set();
  const hookCalls = [];
  const fileFns = new Map();
  const calls = [];
  const finallyBlocks = [];
  const stringRanges = [];
  walk(sf, node => {
    if (ts.isCallExpression(node)) {
      calls.push(node);
      const t = testCallback(node);
      if (t) tests.add(t);
      const s = suiteCallback(node);
      if (s) suites.add(s.body);
      const h = hookCallback(node);
      if (h) hookCalls.push({ call: node, fn: h });
    }
    if (ts.isTryStatement(node) && node.finallyBlock) finallyBlocks.push(node);
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)) stringRanges.push([node.getStart(sf), node.end]);
    if (ts.isFunctionDeclaration(node) && node.name && ts.isSourceFile(node.parent)) fileFns.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent)
      && ts.isSourceFile(node.parent.parent.parent) && isFn(unwrap(node.initializer))) {
      fileFns.set(node.name.text, unwrap(node.initializer));
    }
  });
  const testList = [...tests];
  const testAncestors = node => testList.filter(t => inside(node, t));

  // Regions: each test callback plus the same-file functions it calls, followed transitively.
  const regions = testList.map(root => {
    const nodes = [root];
    const seen = new Set([root]);
    for (let i = 0; i < nodes.length; i++) {
      walk(nodes[i], n => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && fileFns.has(n.expression.text)) {
          const fn = fileFns.get(n.expression.text);
          if (!seen.has(fn)) { seen.add(fn); nodes.push(fn); }
        }
      });
    }
    return { root, nodes };
  });

  // module-state
  const moduleSeen = new Set();
  const checkModuleState = node => {
    let target = null;
    let method = null;
    if (isAssignment(node)) target = node.left;
    else if (isIncDec(node)) target = node.operand;
    else if (ts.isDeleteExpression(node)) target = node.expression;
    else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && MUTATORS.has(node.expression.name.text)) { target = node.expression.expression; method = node.expression.name.text; }
    if (!target) return;
    const t = unwrap(target);
    const direct = ts.isIdentifier(t);
    const id = direct ? t : rootIdentifier(t);
    if (!id) return;
    const reassign = direct && !method;
    if (direct && ts.isDeleteExpression(node)) return;
    const info = resolve(id, suites);
    if (!info.decl || !info.fileLevel) return;
    const key = `${node.pos}:${id.text}`;
    if (moduleSeen.has(key)) return;
    if (reassign) {
      if (info.isConst) return;
      moduleSeen.add(key);
      add(node.getStart(sf), 'module-state', `test reassigns file-level \`${id.text}\``);
    } else if (isContainer(info.decl.initializer)) {
      moduleSeen.add(key);
      add(node.getStart(sf), 'module-state', `test mutates file-level \`${id.text}\`${method ? ` (.${method})` : ''}`);
    }
  };

  // global-patch
  const inRestoringContext = (node, scopes) => {
    for (const tryStmt of finallyBlocks) {
      if (inside(node, tryStmt.finallyBlock) && scopes.some(s => inside(tryStmt, s))) return true;
    }
    return hookCalls.some(h => inside(node, h.fn)
      && (testAncestors(h.call).length === 0 || scopes.some(s => inside(h.call, s))));
  };
  const inAnyRestoringContext = node => finallyBlocks.some(t => inside(node, t.finallyBlock))
    || hookCalls.some(h => inside(node, h.fn));
  const allWrites = [];
  walk(sf, n => { const w = globalWrite(n); if (w) allWrites.push(w); });
  const restored = (write, scopes) => allWrites.some(r => r.node !== write.node
    && (r.key === write.key || (r.key === 'process.env' && write.key.startsWith('process.env.'))
      // a computed key (`global[name] = original` in a loop) restores every property of that object
      || (r.key.endsWith('.*') && write.key.startsWith(r.key.slice(0, -1))))
    && inRestoringContext(r.node, scopes));
  const patchSeen = new Set();

  for (const { nodes } of regions) {
    nodes.forEach(fn => walk(fn, checkModuleState));
    nodes.forEach(fn => walk(fn, n => {
      const w = globalWrite(n);
      if (!w || patchSeen.has(n) || inAnyRestoringContext(n)) return;
      const scopes = [...nodes, ...testAncestors(n)];
      if (restored(w, scopes)) return;
      patchSeen.add(n);
      add(n.getStart(sf), 'global-patch', `test changes \`${w.key}\` and never restores it (use try/finally, t.after or afterEach)`);
    }));
  }

  // fake-timers
  const resets = node => { let r = false; walk(node, n => { if (ts.isCallExpression(n) && dotted(n.expression) === 'mock.timers.reset') r = true; }); return r; };
  const realTimers = node => { let r = false; walk(node, n => { if (ts.isCallExpression(n) && dotted(n.expression) === 'jest.useRealTimers') r = true; }); return r; };
  for (const call of calls) {
    const name = dotted(call.expression);
    if (name === 'mock.timers.enable') {
      const stmt = call.parent;
      let ok = false;
      const block = stmt.parent;
      if (ts.isExpressionStatement(stmt) && block && block.statements) {
        // only declarations that cannot throw (`let renderer;`, `let n = 0;`) may sit between enable and try
        let at = block.statements.indexOf(stmt) + 1;
        const safe = st => ts.isVariableStatement(st) && st.declarationList.declarations.every(d =>
          !d.initializer || ts.isLiteralExpression(d.initializer) || d.initializer.kind === ts.SyntaxKind.NullKeyword);
        while (block.statements[at] && safe(block.statements[at])) at++;
        const next = block.statements[at];
        ok = !!next && ts.isTryStatement(next) && !!next.finallyBlock && resets(next.finallyBlock);
        // enable as the first statement inside the try whose finally resets is equally safe
        if (!ok && ts.isTryStatement(block.parent) && block.parent.tryBlock === block && block.statements[0] === stmt) {
          ok = !!block.parent.finallyBlock && resets(block.parent.finallyBlock);
        }
      }
      if (!ok) add(call.getStart(sf), 'fake-timers', '`mock.timers.enable` must be directly followed by a try whose finally calls `mock.timers.reset()`');
    } else if (name === 'jest.useFakeTimers') {
      const ok = finallyBlocks.some(t => realTimers(t.finallyBlock))
        || hookCalls.some(h => /afterEach/.test(dotted(h.call.expression)) && realTimers(h.fn));
      if (!ok) add(call.getStart(sf), 'fake-timers', '`jest.useFakeTimers()` needs `jest.useRealTimers()` in a finally or afterEach');
    }
  }

  // focused-test
  walk(sf, n => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'only' && ts.isIdentifier(n.expression)
      && (TEST_NAMES.has(n.expression.text) || SUITE_NAMES.has(n.expression.text))) {
      add(n.getStart(sf), 'focused-test', `\`${n.expression.text}.only\` skips every other test`);
    } else if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))
      && n.name.text === 'only' && n.initializer.kind === ts.SyntaxKind.TrueKeyword) {
      add(n.getStart(sf), 'focused-test', '`{ only: true }` skips every other test');
    } else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'fit' || n.expression.text === 'fdescribe')) {
      add(n.getStart(sf), 'focused-test', `\`${n.expression.text}\` skips every other test`);
    }
  });

  // invisible-whitespace: literal code points only; escapes never match.
  INVISIBLE.lastIndex = 0;
  for (let m = INVISIBLE.exec(text); m; m = INVISIBLE.exec(text)) {
    if (m.index === 0 && m[0] === '\uFEFF') continue;
    add(m.index, 'invisible-whitespace', `literal U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} (write it as an escape sequence)`);
  }

  // Exemptions: `// independence-ok: reason` on the finding's line or the line above.
  const waivers = new Map();
  const lineStarts = sf.getLineStarts();
  text.split('\n').forEach((raw, i) => {
    const m = EXEMPT.exec(raw);
    if (!m) return;
    const pos = lineStarts[i] + m.index;
    if (stringRanges.some(([a, b]) => pos >= a && pos < b)) return;
    waivers.set(i + 1, m[1].trim());
  });
  for (const f of found.sort((a, b) => a.line - b.line)) {
    const waiverLine = [f.line, f.line - 1].find(l => waivers.has(l));
    const reason = waiverLine === undefined ? undefined : waivers.get(waiverLine);
    if (reason) exemptions.push({ path: f.path, line: f.line, rule: f.rule, reason });
    else if (violations.some(v => v.path === f.path && v.line === f.line && v.rule === f.rule && v.detail === f.detail)) continue;
    else violations.push(reason === '' ? { ...f, detail: `${f.detail} (independence-ok needs a reason)` } : f);
  }
}

function findViolations(files) {
  return analyze(files).violations;
}

// CLI ------------------------------------------------------------------------------------------

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else out.push(full);
  }
  return out;
}

function globToRegExp(glob) {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '(?:.*/)?');
  return new RegExp(`^${body}$`);
}

function collectTargets(root) {
  const relative = full => path.relative(root, full).split(path.sep).join('/');
  const all = listFiles(root).filter(f => !relative(f).startsWith('.')).map(relative);
  const targets = new Set(all.filter(f => f.startsWith('tests/') && /\.(cjs|js|ts|tsx)$/.test(f)));
  const jestConfig = path.join(root, 'jest.config.cjs');
  if (fs.existsSync(jestConfig)) {
    for (const pattern of require(jestConfig).testMatch ?? []) {
      const regex = globToRegExp(pattern.replace('<rootDir>/', ''));
      all.filter(f => regex.test(f)).forEach(f => targets.add(f));
    }
  }
  return [...targets].sort();
}

function main() {
  const started = Date.now();
  const root = path.resolve(__dirname, '..');
  const targets = collectTargets(root);
  const { violations, exemptions } = analyze(targets.map(p => ({ path: p, text: fs.readFileSync(path.join(root, p), 'utf8') })));
  for (const v of violations) console.log(`${v.path}:${v.line} ${v.rule} ${v.detail}`);
  if (exemptions.length) {
    console.log(`\nExemptions (${exemptions.length}):`);
    for (const e of exemptions) console.log(`  ${e.path}:${e.line} ${e.rule}: ${e.reason}`);
  }
  console.log(`\nChecked ${targets.length} files in ${Date.now() - started} ms: ${violations.length} finding(s).`);
  process.exit(violations.length ? 1 : 0);
}

module.exports = { findViolations, analyze };
if (require.main === module) main();

'use strict';
// Static test-independence check (KAN-121 TEST-04). Parses test sources with the
// TypeScript compiler API, so strings and comments are never matched as code.
// A finding can be waived with `// independence-ok: <reason>` on its own line or on a comment-only
// line directly above; the reason is required and is printed.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const TEST_NAMES = new Set(['test', 'it', 'fit']);
const SUITE_NAMES = new Set(['describe', 'suite', 'fdescribe']);
const MODIFIERS = new Set(['only', 'skip', 'todo']);
const HOOKS = new Set(['after', 'afterEach', 'afterAll']);
// Built-in objects whose members tests must not overwrite without restoring them.
const BUILTIN_GLOBALS = new Set(['console', 'Date', 'Math', 'JSON', 'Intl']);
const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill',
  'copyWithin', 'set', 'delete', 'clear', 'add']);
const CONTAINERS = new Set(['Array', 'Map', 'Set', 'WeakMap', 'WeakSet']);
const INVISIBLE = /[\u00A0\u00AD\u2000-\u200F\u2028\u2029\u202F\u205F-\u2064\u3000\uFEFF]/g;
const EXEMPT = /\/\/\s*independence-ok:([^\r\n]*)/;

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

function hookName(call) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
}

function hookCallback(call) {
  return HOOKS.has(hookName(call)) ? lastFunctionArg(call) : null;
}

function bindingNames(name, out = []) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, out);
  return out;
}

const shadowedResult = () => ({ decl: null, shadowed: true });
const declaredResult = (found, scope) => (found
  ? { decl: found, scope, shadowed: true, isConst: !!(found.parent.flags & ts.NodeFlags.Const) }
  : null);
const findDeclaration = (declarations, name) => declarations.find(d => bindingNames(d.name).includes(name));
const isForLoop = n => ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n);
const isStatementScope = n => ts.isBlock(n) || ts.isSourceFile(n) || ts.isCaseClause(n) || ts.isDefaultClause(n);

// Statements of one scope: the first variable declaration of `name`, or a same-named function or class.
function lookupInStatements(statements, name) {
  let found = null;
  for (const st of statements) {
    if (ts.isVariableStatement(st)) found = findDeclaration(st.declarationList.declarations, name);
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name) return { shadow: true };
    if (found) break;
  }
  return { found };
}

// What one ancestor node says about `name`: a result, or null when it does not declare it.
function lookupInScope(p, name) {
  if (isFn(p)) return p.parameters.some(par => bindingNames(par.name).includes(name)) ? shadowedResult() : null;
  if (ts.isCatchClause(p)) {
    return p.variableDeclaration && bindingNames(p.variableDeclaration.name).includes(name) ? shadowedResult() : null;
  }
  if (isForLoop(p) && p.initializer && ts.isVariableDeclarationList(p.initializer)) {
    return declaredResult(findDeclaration(p.initializer.declarations, name), p);
  }
  if (isStatementScope(p)) {
    const { shadow, found } = lookupInStatements(p.statements, name);
    return shadow ? shadowedResult() : declaredResult(found, p);
  }
  return null;
}

// Finds the declaration an identifier refers to and the scope node (block, file) that declares it.
function resolve(id) {
  for (let p = id.parent; p; p = p.parent) {
    const hit = lookupInScope(p, id.text);
    if (hit) return hit;
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

function elementKey(e) {
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return ts.isStringLiteralLike(e.argumentExpression) ? e.argumentExpression.text : '*';
}

// The property a write targets, e.g. "global.fetch" or "process.env.LOCALE"; null for anything else.
function globalKey(target) {
  const e = unwrap(target);
  if (!ts.isPropertyAccessExpression(e) && !ts.isElementAccessExpression(e)) return null;
  const prop = elementKey(e);
  const obj = unwrap(e.expression);
  if (ts.isIdentifier(obj) && (obj.text === 'global' || obj.text === 'globalThis')) return `global.${prop}`;
  if (ts.isIdentifier(obj) && BUILTIN_GLOBALS.has(obj.text) && !resolve(obj).shadowed) return `${obj.text}.${prop}`;
  if (ts.isPropertyAccessExpression(obj) && ts.isIdentifier(obj.expression) && obj.expression.text === 'process'
    && obj.name.text === 'env') return `process.env.${prop}`;
  return null;
}

const isProcessEnv = e => ts.isPropertyAccessExpression(e) && e.name.text === 'env' && ts.isIdentifier(e.expression)
  && e.expression.text === 'process';
const writeTo = (node, key) => (key ? { node, key } : null);

// A write to a global-ish property: assignment or delete. Returns { node, key } or null.
function globalWrite(node) {
  if (isAssignment(node)) {
    const left = unwrap(node.left);
    return isProcessEnv(left) ? { node, key: 'process.env' } : writeTo(node, globalKey(left));
  }
  if (ts.isDeleteExpression(node)) return writeTo(node, globalKey(node.expression));
  return null;
}

function dotted(n) {
  if (ts.isIdentifier(n)) return n.text;
  return ts.isPropertyAccessExpression(n) ? `${dotted(n.expression)}.${n.name.text}` : '?';
}

function analyze(files) {
  const violations = [];
  const exemptions = [];
  for (const { path: file, text } of files) analyzeFile(file, text, violations, exemptions);
  return { violations, exemptions };
}

// Structure of one file, collected in a single walk.
function isStringPiece(node) {
  return ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
}

function isTopLevelFunctionVariable(node) {
  return ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !!node.initializer
    && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent)
    && ts.isSourceFile(node.parent.parent.parent) && isFn(unwrap(node.initializer));
}

function recordCall(structure, node) {
  structure.calls.push(node);
  const test = testCallback(node);
  if (test) structure.tests.add(test);
  const hook = hookCallback(node);
  if (hook) structure.hookCalls.push({ call: node, fn: hook });
}

function recordFileFunction(structure, node) {
  if (ts.isFunctionDeclaration(node) && node.name && ts.isSourceFile(node.parent)) {
    structure.fileFns.set(node.name.text, node);
  } else if (isTopLevelFunctionVariable(node)) {
    structure.fileFns.set(node.name.text, unwrap(node.initializer));
  }
}

function collectStructure(sf) {
  const structure = { tests: new Set(), hookCalls: [], fileFns: new Map(), calls: [], finallyBlocks: [], stringRanges: [] };
  walk(sf, node => {
    if (ts.isCallExpression(node)) recordCall(structure, node);
    if (ts.isTryStatement(node) && node.finallyBlock) structure.finallyBlocks.push(node);
    if (isStringPiece(node)) structure.stringRanges.push([node.getStart(sf), node.end]);
    recordFileFunction(structure, node);
  });
  return structure;
}

// A test callback plus the same-file functions it calls, followed transitively.
function followedFunctions(root, fileFns) {
  const nodes = [root];
  const seen = new Set([root]);
  for (const current of nodes) {
    walk(current, n => {
      const callee = ts.isCallExpression(n) && ts.isIdentifier(n.expression) ? fileFns.get(n.expression.text) : undefined;
      if (callee && !seen.has(callee)) { seen.add(callee); nodes.push(callee); }
    });
  }
  return nodes;
}

function createContext(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const found = [];
  const ctx = { file, text, sf, found, ...collectStructure(sf) };
  ctx.add = (pos, rule, detail) => found.push({
    path: file, line: sf.getLineAndCharacterOfPosition(pos).line + 1, rule, detail });
  const testList = [...ctx.tests];
  ctx.testAncestors = node => testList.filter(t => inside(node, t));
  // Regions: each test callback plus the functions it reaches.
  ctx.regions = testList.map(root => ({ root, nodes: followedFunctions(root, ctx.fileFns) }));
  ctx.allWrites = [];
  walk(sf, n => { const w = globalWrite(n); if (w) ctx.allWrites.push(w); });
  ctx.moduleSeen = new Set();
  return ctx;
}

// module-state ---------------------------------------------------------------------------------

function mutationTarget(node) {
  if (isAssignment(node)) return { target: node.left, method: null };
  if (isIncDec(node)) return { target: node.operand, method: null };
  if (ts.isDeleteExpression(node)) return { target: node.expression, method: null };
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && MUTATORS.has(node.expression.name.text)) {
    return { target: node.expression.expression, method: node.expression.name.text };
  }
  return null;
}

// A binding is shared when some test callback that contains the mutation sits inside the binding's
// scope: file level and describe bodies are shared by every test, a parent test's locals by its subtests.
// `root` stands in for the test that reached a followed same-file function.
function isSharedBinding(ctx, node, root, scope) {
  return [...ctx.testAncestors(node), root].some(t => t !== scope && inside(t, scope));
}

function mutatesDetail(name, method) {
  const via = method ? ` (.${method})` : '';
  return `test mutates file-level \`${name}\`${via}`;
}

function checkModuleState(ctx, node, root) {
  const mutation = mutationTarget(node);
  if (!mutation) return;
  const t = unwrap(mutation.target);
  const direct = ts.isIdentifier(t);
  const id = direct ? t : rootIdentifier(t);
  if (!id || (direct && ts.isDeleteExpression(node))) return;
  const info = resolve(id);
  if (!info.decl || !isSharedBinding(ctx, node, root, info.scope)) return;
  const key = `${node.pos}:${id.text}`;
  if (ctx.moduleSeen.has(key)) return;
  const report = detail => { ctx.moduleSeen.add(key); ctx.add(node.getStart(ctx.sf), 'module-state', detail); };
  if (direct && !mutation.method) {
    if (!info.isConst) report(`test reassigns file-level \`${id.text}\``);
  } else if (isContainer(info.decl.initializer)) {
    report(mutatesDetail(id.text, mutation.method));
  }
}

// global-patch ---------------------------------------------------------------------------------

// A file-level hook outside every test restores per test only as afterEach; file-level `after` runs
// once, after all tests.
function hookRestores(ctx, hook, scopes) {
  if (ctx.testAncestors(hook.call).length === 0) return hookName(hook.call) === 'afterEach';
  return scopes.some(s => inside(hook.call, s));
}

function inRestoringContext(ctx, node, scopes) {
  const inFinally = ctx.finallyBlocks.some(tryStmt => inside(node, tryStmt.finallyBlock)
    && scopes.some(s => inside(tryStmt, s)));
  return inFinally || ctx.hookCalls.some(h => inside(node, h.fn) && hookRestores(ctx, h, scopes));
}

const inAnyRestoringContext = (ctx, node) => ctx.finallyBlocks.some(t => inside(node, t.finallyBlock))
  || ctx.hookCalls.some(h => inside(node, h.fn));

// A computed key (`global[name] = original` in a loop) restores every property of that object.
const restoresKey = (restore, key) => restore.key === key
  || (restore.key === 'process.env' && key.startsWith('process.env.'))
  || (restore.key.endsWith('.*') && key.startsWith(restore.key.slice(0, -1)));

const restored = (ctx, write, scopes) => ctx.allWrites.some(r => r.node !== write.node
  && restoresKey(r, write.key) && inRestoringContext(ctx, r.node, scopes));

function checkGlobalPatch(ctx, n, nodes, patchSeen) {
  const write = globalWrite(n);
  if (!write || patchSeen.has(n) || inAnyRestoringContext(ctx, n)) return;
  if (restored(ctx, write, [...nodes, ...ctx.testAncestors(n)])) return;
  patchSeen.add(n);
  ctx.add(n.getStart(ctx.sf), 'global-patch',
    `test changes \`${write.key}\` and never restores it (use try/finally, t.after or afterEach)`);
}

function checkRegions(ctx) {
  const patchSeen = new Set();
  for (const { root, nodes } of ctx.regions) {
    nodes.forEach(fn => walk(fn, n => checkModuleState(ctx, n, root)));
    nodes.forEach(fn => walk(fn, n => checkGlobalPatch(ctx, n, nodes, patchSeen)));
  }
}

// global-patch via the file-level node:test `mock.method(<global>, ...)`; `t.mock.method` restores itself.
function isGlobalTarget(arg) {
  const e = unwrap(arg);
  return ts.isIdentifier(e) && (e.text === 'global' || e.text === 'globalThis'
    || (BUILTIN_GLOBALS.has(e.text) && !resolve(e).shadowed));
}

const isGlobalMockMethod = n => ts.isCallExpression(n) && dotted(n.expression) === 'mock.method'
  && n.arguments.length > 0 && isGlobalTarget(n.arguments[0]);

// The handle the result is kept in: `const m = mock.method(...)` or `m = mock.method(...)`.
function mockHandle(n) {
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && isAssignment(p) && p.right === n && ts.isIdentifier(p.left)) return p.left.text;
  return null;
}

function restoreCall(ctx, name, scopes) {
  return ctx.calls.some(c => {
    const d = dotted(c.expression);
    return (d === 'mock.restoreAll' || d === 'mock.reset' || (name && d === `${name}.mock.restore`))
      && inRestoringContext(ctx, c, scopes);
  });
}

function checkMockMethod(ctx, n, nodes, mockSeen) {
  if (mockSeen.has(n) || !isGlobalMockMethod(n) || inAnyRestoringContext(ctx, n)) return;
  if (restoreCall(ctx, mockHandle(n), [...nodes, ...ctx.testAncestors(n)])) return;
  mockSeen.add(n);
  ctx.add(n.getStart(ctx.sf), 'global-patch',
    'test patches a global with the file-level `mock.method` and never restores it (use `t.mock.method`, or restore in finally, t.after or afterEach)');
}

function checkMockMethods(ctx) {
  const mockSeen = new Set();
  for (const { nodes } of ctx.regions) nodes.forEach(fn => walk(fn, n => checkMockMethod(ctx, n, nodes, mockSeen)));
}

// fake-timers ----------------------------------------------------------------------------------

function containsCall(node, name) {
  let hit = false;
  walk(node, n => { if (ts.isCallExpression(n) && dotted(n.expression) === name) hit = true; });
  return hit;
}

const KEYWORD_LITERALS = new Set([ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword]);
const isNegativeNumber = e => ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken
  && ts.isNumericLiteral(e.operand);
const isEmptyArrayOrObject = e => (ts.isArrayLiteralExpression(e) && e.elements.length === 0)
  || (ts.isObjectLiteralExpression(e) && e.properties.length === 0);
const isNonThrowingLiteral = e => ts.isLiteralExpression(e) || KEYWORD_LITERALS.has(e.kind)
  || isNegativeNumber(e) || isEmptyArrayOrObject(e);
// only declarations that cannot throw (`let renderer;`, `let n = 0;`) may sit between enable and try
const isSafeDeclaration = st => ts.isVariableStatement(st)
  && st.declarationList.declarations.every(d => !d.initializer || isNonThrowingLiteral(d.initializer));

const resetsInFinally = tryStmt => !!tryStmt.finallyBlock && containsCall(tryStmt.finallyBlock, 'mock.timers.reset');

function enableIsProtected(call) {
  const stmt = call.parent;
  const block = stmt.parent;
  if (!(ts.isExpressionStatement(stmt) && block?.statements)) return false;
  let at = block.statements.indexOf(stmt) + 1;
  while (block.statements[at] && isSafeDeclaration(block.statements[at])) at++;
  const next = block.statements[at];
  if (next && ts.isTryStatement(next) && resetsInFinally(next)) return true;
  // enable as the first statement inside the try whose finally resets is equally safe
  return ts.isTryStatement(block.parent) && block.parent.tryBlock === block && block.statements[0] === stmt
    && resetsInFinally(block.parent);
}

function jestTimersRestored(ctx) {
  return ctx.finallyBlocks.some(t => containsCall(t.finallyBlock, 'jest.useRealTimers'))
    || ctx.hookCalls.some(h => /afterEach/.test(dotted(h.call.expression)) && containsCall(h.fn, 'jest.useRealTimers'));
}

function checkFakeTimers(ctx) {
  for (const call of ctx.calls) {
    const name = dotted(call.expression);
    if (name === 'mock.timers.enable') {
      if (!enableIsProtected(call)) {
        ctx.add(call.getStart(ctx.sf), 'fake-timers', '`mock.timers.enable` must be directly followed by a try whose finally calls `mock.timers.reset()`');
      }
    } else if (name === 'jest.useFakeTimers' && !jestTimersRestored(ctx)) {
      ctx.add(call.getStart(ctx.sf), 'fake-timers', '`jest.useFakeTimers()` needs `jest.useRealTimers()` in a finally or afterEach');
    }
  }
}

// focused-test ---------------------------------------------------------------------------------

const isFocusedAccess = n => ts.isPropertyAccessExpression(n) && n.name.text === 'only' && ts.isIdentifier(n.expression)
  && (TEST_NAMES.has(n.expression.text) || SUITE_NAMES.has(n.expression.text));
const isOnlyTrue = n => ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))
  && n.name.text === 'only' && n.initializer.kind === ts.SyntaxKind.TrueKeyword;
const isFocusedCall = n => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
  && (n.expression.text === 'fit' || n.expression.text === 'fdescribe');

function focusedDetail(n) {
  if (isFocusedAccess(n)) return `\`${n.expression.text}.only\` skips every other test`;
  if (isOnlyTrue(n)) return '`{ only: true }` skips every other test';
  if (isFocusedCall(n)) return `\`${n.expression.text}\` skips every other test`;
  return null;
}

function checkFocusedTests(ctx) {
  walk(ctx.sf, n => {
    const detail = focusedDetail(n);
    if (detail) ctx.add(n.getStart(ctx.sf), 'focused-test', detail);
  });
}

// invisible-whitespace: literal code points only; escapes never match ---------------------------

const isVisible = ch => ch !== undefined && /^[^\s'"`\u200B-\u200F\uFEFF]$/u.test(ch);

// A leading BOM, or a ZWJ/ZWNJ joining two visible characters (emoji sequences, Persian/Indic text).
function isLegitimateInvisible(text, m) {
  if (m.index === 0 && m[0] === '\uFEFF') return true;
  const joiner = m[0] === '\u200D' || m[0] === '\u200C';
  return joiner && isVisible(text[m.index - 1]) && isVisible(text[m.index + 1]);
}

function checkInvisibleWhitespace(ctx) {
  INVISIBLE.lastIndex = 0;
  for (let m = INVISIBLE.exec(ctx.text); m; m = INVISIBLE.exec(ctx.text)) {
    if (isLegitimateInvisible(ctx.text, m)) continue;
    const hex = m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    ctx.add(m.index, 'invisible-whitespace', `literal U+${hex} (write it as an escape sequence)`);
  }
}

// Exemptions: `// independence-ok: reason` on the finding's line or a comment-only line above it ---

function collectWaivers(ctx) {
  const waivers = new Map();
  const lineStarts = ctx.sf.getLineStarts();
  ctx.text.split('\n').forEach((raw, i) => {
    const m = EXEMPT.exec(raw);
    if (!m) return;
    const pos = lineStarts[i] + m.index;
    if (ctx.stringRanges.some(([a, b]) => pos >= a && pos < b)) return;
    waivers.set(i + 1, { reason: m[1].trim(), alone: raw.slice(0, m.index).trim() === '' });
  });
  return waivers;
}

// a trailing waiver covers only its own line; a comment-only waiver also covers the next line
function waiverFor(waivers, line) {
  const above = waivers.get(line - 1);
  return waivers.get(line) ?? (above?.alone ? above : undefined);
}

const sameFinding = (a, b) => a.path === b.path && a.line === b.line && a.rule === b.rule && a.detail === b.detail;

function settleFindings(ctx, violations, exemptions) {
  const waivers = collectWaivers(ctx);
  for (const f of ctx.found.sort((a, b) => a.line - b.line)) {
    const reason = waiverFor(waivers, f.line)?.reason;
    if (reason) exemptions.push({ path: f.path, line: f.line, rule: f.rule, reason });
    else if (violations.some(v => sameFinding(v, f))) continue;
    else violations.push(reason === '' ? { ...f, detail: `${f.detail} (independence-ok needs a reason)` } : f);
  }
}

function analyzeFile(file, text, violations, exemptions) {
  const ctx = createContext(file, text);
  checkRegions(ctx);
  checkMockMethods(ctx);
  checkFakeTimers(ctx);
  checkFocusedTests(ctx);
  checkInvisibleWhitespace(ctx);
  settleFindings(ctx, violations, exemptions);
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

// stands in for `**/` while a lone `*` is translated
const GLOB_STAR_DIRS = '\u0000';

function globToRegExp(glob) {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
    .replaceAll('**/', GLOB_STAR_DIRS)
    .replaceAll('*', '[^/]*')
    .replaceAll(GLOB_STAR_DIRS, '(?:.*/)?');
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
  // plain code-unit order, as the default sort gives, so the report order stays the same
  return [...targets].sort((a, b) => Number(a > b) - Number(a < b));
}

function main() {
  const started = Date.now();
  const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
  const targets = collectTargets(root);
  if (!targets.length) {
    console.error(`No test files found under ${root}; refusing to report a clean result for an empty scan.`);
    process.exit(1);
  }
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

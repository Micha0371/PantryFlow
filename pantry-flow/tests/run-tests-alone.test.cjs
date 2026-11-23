const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeName, topLevelNames, reportedCount } = require('../scripts/run-tests-alone.cjs');

// Captured from `node --test --test-reporter=junit` on a file with a leaf test, a test with a
// subtest, a describe block and XML-escaped characters. Nested testcases sit inside a testsuite.
const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
\t<testsuite name="top (a) [x]" time="0.001203" disabled="0" errors="0" tests="1" failures="0" skipped="0" timestamp="2026-11-23T02:11:26.686Z" hostname="host">
\t\t<testcase name="sub" time="0.000498" classname="top (a) [x]" file="s.test.cjs"/>
\t</testsuite>
\t<testcase name="plain" time="0.000089" classname="test" file="s.test.cjs"/>
\t<testcase name="a &amp; b &lt;c&gt; &quot;q&quot;" time="0.000089" classname="test" file="s.test.cjs">
\t\t<failure type="testCodeFailure" message="boom">stack</failure>
\t</testcase>
\t<testsuite name="suite" time="0.000315" disabled="0" errors="0" tests="1" failures="0" skipped="0" timestamp="2026-11-23T02:11:26.690Z" hostname="host">
\t\t<testcase name="in suite" time="0.000094" classname="suite" file="s.test.cjs"/>
\t</testsuite>
\t<!-- tests 5 -->
\t<!-- suites 2 -->
\t<!-- pass 5 -->
</testsuites>`;

test('topLevelNames returns top-level tests and suites, not nested ones', () => {
  assert.deepEqual(topLevelNames(SAMPLE), ['top (a) [x]', 'plain', 'a & b <c> "q"', 'suite']);
});

test('topLevelNames de-duplicates repeated names', () => {
  const xml = '<testsuites><testcase name="x" time="1"/><testcase name="x" time="1"/></testsuites>';
  assert.deepEqual(topLevelNames(xml), ['x']);
});

test('reportedCount reads the tests total from the junit trailer', () => {
  assert.equal(reportedCount(SAMPLE), 5);
  assert.equal(reportedCount('<testsuites></testsuites>'), 0);
});

test('escapeName makes names with regex characters match only themselves', () => {
  const names = ['f(x) [a] a.b a+b a?b $5 "q" \'s\' ^x|y {1} \\d \\ *'];
  names.push('a.b', 'a+b', 'a?b', 'plain', '(');
  for (const name of names) {
    const re = new RegExp(`^${escapeName(name)}$`);
    assert.ok(re.test(name), `${name} matches itself`);
  }
  assert.ok(!new RegExp(`^${escapeName('a.b')}$`).test('axb'));
  assert.ok(!new RegExp(`^${escapeName('a+b')}$`).test('aab'));
  assert.ok(!new RegExp(`^${escapeName('a?b')}$`).test('b'));
  assert.ok(!new RegExp(`^${escapeName('[ab]')}$`).test('a'));
  assert.ok(!new RegExp(`^${escapeName('(x)')}$`).test('x'));
  assert.ok(!new RegExp(`^${escapeName('cost $')}$`).test('cost'));
});

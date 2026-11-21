const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./helpers.cjs');

// KAN-60: the German catalogue covers exactly the English keys, and no key used in the
// code is missing from the catalogue (a missing key would show its internal name).
const { en } = load('lib/i18n/en.ts');
const { de } = load('lib/i18n/de.ts');
const root = path.resolve(__dirname, '..');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

test('German and English catalogues have exactly the same keys, and no German text is empty', () => {
  const missing = Object.keys(en).filter(key => !(key in de));
  const extra = Object.keys(de).filter(key => !(key in en));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
  const empty = Object.entries(de).filter(([, value]) => typeof value !== 'string' || value.trim() === '').map(([key]) => key);
  assert.deepEqual(empty, []);
});

test('every translation key literal used in the app exists in the English catalogue', () => {
  const used = new Set();
  for (const dir of ['app', 'components', 'hooks', 'lib']) {
    for (const file of sourceFiles(path.join(root, dir))) {
      if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
      const text = fs.readFileSync(file, 'utf8');
      // t('key') or t("key") calls, and error keys handed to t() by the data layer.
      for (const match of text.matchAll(/\bt\(\s*['"]([a-z][a-z0-9_]*)['"]/g)) used.add(match[1]);
      for (const match of text.matchAll(/['"`](err_[a-z0-9_]+)['"`]/g)) used.add(match[1]);
    }
  }
  assert.ok(used.size > 50, `expected many keys, found ${used.size}`);
  const unknown = [...used].filter(key => !(key in en)).sort();
  assert.deepEqual(unknown, []);
});

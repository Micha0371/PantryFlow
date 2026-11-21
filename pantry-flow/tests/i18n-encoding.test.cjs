const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

// KAN-119: text that was UTF-8 encoded twice (or decoded as Windows-1252) shows up as
// "Ã¤" for "ä", "â€¦" for "…" and so on. German umlauts and ß make this visible, so every
// shipped catalogue is scanned for those sequences, and for the replacement character.
const MOJIBAKE = [
  /Ã[\u0080-¿]/, // Latin-1 letters (ä ö ü ß é …) after a double encoding
  /â€/, // punctuation such as … – “ ” ’ after a double encoding
  /Â[\u0080-¿]/, // non-breaking space, ©, ° and friends after a double encoding
  /�/, // the replacement character left by a failed decode
];
const looksMisencoded = text => MOJIBAKE.some(pattern => pattern.test(text));

test('the mojibake detector flags double-encoded text and leaves real characters alone', () => {
  for (const bad of ['GrÃ¶ÃŸe', 'Ã¤ndern', 'Loadingâ€¦', 'Â°C', 'Fehler �']) assert.equal(looksMisencoded(bad), true, bad);
  for (const good of ['Größe', 'ändern', 'Loading…', '°C', 'café', 'Straße – Ärger “x” ’s']) assert.equal(looksMisencoded(good), false, good);
});

test('no shipped translation catalogue contains mis-encoded text', () => {
  const catalogues = { en: load('lib/i18n/en.ts').en, de: load('lib/i18n/de.ts').de };
  const offenders = [];
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    for (const [key, value] of Object.entries(catalogue)) {
      if (typeof value === 'string' && looksMisencoded(value)) offenders.push(`${locale}.${key}`);
    }
  }
  assert.deepEqual(offenders, []);
});

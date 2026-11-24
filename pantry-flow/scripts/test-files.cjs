'use strict';
// The node test files of the project. An empty list is an error: `node --test` reports success
// when nothing matches.
const fs = require('node:fs');

function nodeTestFiles(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.cjs')).sort();
  if (files.length === 0) throw new Error(`No *.test.cjs files found in ${dir}; refusing to report success for an empty run.`);
  return files;
}

module.exports = { nodeTestFiles };

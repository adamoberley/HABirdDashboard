#!/usr/bin/env node
// Bird Card test runner: each tests/test-*.js is a standalone jsdom
// scenario that exits 0 on pass. Run them sequentially with a timeout
// and fail loudly on the first red.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => /^test-.*\.js$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const started = Date.now();
  const res = spawnSync(process.execPath, [path.join(dir, f)], {
    timeout: 150000,
    encoding: 'utf8',
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = res.status === 0;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + f + '  (' + secs + 's)');
  if (!ok) {
    failed++;
    console.log((res.stdout || '') + (res.stderr || ''));
  }
}
console.log('\n' + (files.length - failed) + '/' + files.length + ' suites passed');
process.exit(failed ? 1 : 0);

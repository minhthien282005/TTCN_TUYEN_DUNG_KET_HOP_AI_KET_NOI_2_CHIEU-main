'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const skippedDirectories = new Set(['.git', 'node_modules']);
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
}

collect(root);
files.sort();
const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push({ file: path.relative(root, file), output: result.stderr || result.stdout || result.error?.message || 'Unknown syntax error' });
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`\n${failure.file}\n${failure.output}`);
  process.exitCode = 1;
} else {
  console.log(`JavaScript syntax OK (${files.length} files).`);
}

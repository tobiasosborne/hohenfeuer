// tests/unit/rules-purity.test.js - owns the grep-level purity check of DESIGN section 9 pure modules
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src');

const PURE_DIRS = ['core', 'world', 'sim', 'npc', 'ai'];
const PURE_FILES = ['player/commands.js', 'player/interact.js', 'ui/layout.js', 'render/mesher.js', 'contracts.js', 'tuning.js'];
// DESIGN section 9 marks these IO although they sit in pure directories.
const IO_EXCEPTIONS = new Set(['core/loop.js']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && p.endsWith('.js')) out.push(p);
  }
  return out;
}

export function pureFiles() {
  const set = new Set();
  for (const d of PURE_DIRS) for (const f of walk(path.join(SRC, d))) set.add(f);
  for (const f of PURE_FILES) { const p = path.join(SRC, f); if (fs.existsSync(p)) set.add(p); }
  for (const f of walk(path.join(SRC, 'plugins'))) if (f.endsWith('.sim.js')) set.add(f);
  return [...set].filter(f => !IO_EXCEPTIONS.has(path.relative(SRC, f).split(path.sep).join('/'))).sort();
}

const RULES = [
  { name: 'import of three', re: /\bfrom\s*['"]three(\/[^'"]*)?['"]|\bimport\s*\(\s*['"]three|\brequire\s*\(\s*['"]three|\bimport\s*['"]three/ },
  { name: 'import of *.view.js', re: /(?:from|import)\s*\(?\s*['"][^'"]*\.view(?:\.js)?['"]/ },
  { name: 'DOM/clock global', re: /\b(?:document|window|navigator|performance|requestAnimationFrame)\b/ },
  { name: 'Math.random', re: /\bMath\.random\b/ },
  { name: 'Date.now', re: /\bDate\.now\b/ },
  { name: 'new Date', re: /\bnew\s+Date\b/ },
  { name: 'non-deterministic Math fn (use fmath)', re: /\bMath\.(?:sin|cos|tan|atan2|exp|log|pow)\b/ },
];

/** Blank out comments and string contents (except import specifiers) while preserving line numbers. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; }
    else if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      i += 2;
    } else { out += c; i++; }
  }
  return out;
}

export function scan(file) {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(ROOT, file);
  const v = [];
  text.split('\n').forEach((line, idx) => {
    for (const r of RULES) if (r.re.test(line)) v.push(`${rel}:${idx + 1}: ${r.name}: ${line.trim()}`);
  });
  return v;
}

test('pure modules contain no forbidden imports or globals', () => {
  const files = pureFiles();
  const violations = files.flatMap(scan);
  assert.equal(violations.length, 0, `\n${violations.length} purity violation(s) in ${files.length} pure file(s):\n${violations.join('\n')}`);
});

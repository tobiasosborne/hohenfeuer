// tests/unit/rules-cleanroom.test.js - owns the clean-room check: no ripped-asset references or copies in shipped dirs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_BYTES = 50 * 1024 * 1024;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const small = f => fs.statSync(f).size < MAX_BYTES;

test('no file under src/, assets/, dist/ references assets-ripped or downloads/', () => {
  const needles = ['assets-ripped', 'downloads/'].map(s => Buffer.from(s));
  const bad = [];
  for (const d of ['src', 'assets', 'dist']) {
    for (const f of walk(path.join(ROOT, d))) {
      if (!small(f)) continue;
      const buf = fs.readFileSync(f);
      for (const nd of needles) {
        if (buf.includes(nd)) { bad.push(`${path.relative(ROOT, f)}: references "${nd}"`); }
      }
    }
  }
  assert.equal(bad.length, 0, `\n${bad.join('\n')}`);
});

test('no asset under assets/ is byte-identical to a file in assets-ripped/', (t) => {
  const ripped = walk(path.join(ROOT, 'assets-ripped')).filter(small);
  if (ripped.length === 0) return t.skip('assets-ripped/ missing or empty');
  const hashes = new Map();
  for (const f of ripped) hashes.set(sha(f), f);
  const bad = [];
  for (const f of walk(path.join(ROOT, 'assets')).filter(small)) {
    const h = sha(f);
    if (hashes.has(h)) bad.push(`${path.relative(ROOT, f)} == ${path.relative(ROOT, hashes.get(h))}`);
  }
  assert.equal(bad.length, 0, `\n${bad.join('\n')}`);
});

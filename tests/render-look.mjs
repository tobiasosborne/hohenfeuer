// Owns reproducible reference-only look-loop sheets and 8-pixel Gaussian band metrics; never writes shipped assets.
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const iteration = process.argv[2];
if (!/^\d+$/.test(iteration ?? '')) throw new Error('Usage: node tests/render-look.mjs <iteration> [--archived]');
const destination = resolve(`assets-ripped/look-loop/pass1/iteration-${iteration}`);
const originals = resolve('assets-ripped/goldens-original');
const pairs = {
  'tb1-spawn': '119-forest-towers-close.png',
  'tb1-first-shot': '055-cannon-projectile.png',
  'rampart-north': '049-cannon-default-aim.png',
  'weapon-view-cannon': '049-cannon-default-aim.png',
  'courtyard-palace': '074-forest-overview-south.png',
  'crew-at-cannon': '119-forest-towers-close.png',
  'cannon-sight': '049-cannon-default-aim.png',
  'muzzle-flash': '054-cannon-muzzle-smoke.png',
  'smoke-trail': '055-cannon-projectile.png',
  'impact-dust': '170-no-rebuild-first-strike.png',
};
await mkdir(destination, { recursive: true });
if (!process.argv.includes('--archived')) {
  await copyFile('tests/goldens/poses.json', `${destination}/poses.json`);
  for (const name of Object.keys(pairs)) await copyFile(`tests/goldens/${name}.png`, `${destination}/${name}.png`);
}
const python = String.raw`
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
o = json.loads(sys.stdin.read())
bands = {'sky': [270,112,800,280], 'ground': [16,360,990,548], 'scene': [16,112,990,548], 'whole': [0,0,1024,768]}
result = {'iteration': o['iteration'], 'blur_radius_px': 8, 'bands_xyxy': bands, 'poses': {}}
for pose, ref in o['pairs'].items():
    ours = Image.open(Path(o['destination']) / (pose + '.png')).convert('RGB')
    original = Image.open(Path(o['originals']) / ref).convert('RGB')
    assert ours.size == original.size == (1024,768)
    a, b = [np.asarray(im.filter(ImageFilter.GaussianBlur(8)), dtype=np.float64) for im in (ours, original)]
    entry = {'reference': ref}
    for band, (x0,y0,x1,y1) in bands.items():
        aa, bb = a[y0:y1,x0:x1], b[y0:y1,x0:x1]
        entry[band] = {'mae': round(float(np.abs(aa-bb).mean()), 3),
                       'ours_rgb': np.round(aa.mean(axis=(0,1)),3).tolist(),
                       'original_rgb': np.round(bb.mean(axis=(0,1)),3).tolist()}
    result['poses'][pose] = entry
result['mean_mae'] = {band: round(float(np.mean([v[band]['mae'] for v in result['poses'].values()])),3) for band in bands}
Path(o['destination'], 'metrics.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result['mean_mae']))
`;
const metrics = spawnSync('python3', ['-I', '-c', python], {
  input: JSON.stringify({ iteration: Number(iteration), destination, originals, pairs }), encoding: 'utf8',
});
if (metrics.status) throw new Error(metrics.stderr);
console.log(`iteration ${iteration}: ${metrics.stdout.trim()}`);
const groups = {
  weapons: ['weapon-view-cannon', 'cannon-sight', 'tb1-first-shot'],
  environment: ['rampart-north', 'courtyard-palace', 'crew-at-cannon', 'tb1-spawn'],
  effects: ['muzzle-flash', 'smoke-trail', 'impact-dust'],
};
for (const [sheet, names] of Object.entries(groups)) {
  const inputs = names.flatMap(name => ['-label', pairs[name], `${originals}/${pairs[name]}`, '-label', `iteration ${iteration}: ${name}`, `${destination}/${name}.png`]);
  const result = spawnSync('montage', ['-font', 'DejaVu-Sans', '-pointsize', '16', ...inputs,
    '-geometry', '512x384+4+4', '-tile', `2x${names.length}`, `${destination}/${sheet}-sheet.png`], { encoding: 'utf8' });
  if (result.status) throw new Error(result.stderr);
}
await writeFile(`${destination}/sources.json`, JSON.stringify(pairs, null, 2) + '\n');

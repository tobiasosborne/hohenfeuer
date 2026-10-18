# owns: fingerprints for immutable experiment conditions and the final simulation/harness source.
from pathlib import Path
import hashlib,json,difflib
D=Path(__file__).resolve().parent;P=D.parents[2]
def manifest(root):
 paths=['src/contracts.js','src/tuning.js']+[str(p.relative_to(root)) for d in ['core','world','sim','npc','ai','plugins'] for p in (root/'src'/d).rglob('*.js') if not p.name.endswith('.view.js') and p.name!='index.view.js']
 h=hashlib.sha256();files={}
 for p in sorted(paths):
  b=(root/p).read_bytes();files[p]=hashlib.sha256(b).hexdigest();h.update(p.encode());h.update(b)
 scripts={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['scripts/novice.mjs','scripts/sweep.mjs']}
 return {'simulationSha256':h.hexdigest(),'files':files,'scripts':scripts}
roots={name:Path('/tmp/castle-wave3-'+name) for name in ['baseline','events','throne','candidate','final']}
roots['live']=P
out={k:manifest(p) for k,p in roots.items()}
out['liveMatchesFinal']=out['live']==out['final']
base=roots['baseline'];owned=['src/sim','src/npc','src/ai','src/plugins/maps','src/plugins/castles','src/plugins/weapons']
files=sorted({str(p.relative_to(r)) for r in [P,base] for d in owned for p in (r/d).rglob('*.js')}|{'src/tuning.js','scripts/novice.mjs','scripts/sweep.mjs'})
changes=[];patch=[]
for f in files:
 before=(base/f).read_text() if (base/f).exists() else '';after=(P/f).read_text() if (P/f).exists() else ''
 if before!=after:
  changes.append(f);patch.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='before/'+f,tofile='after/'+f))
out['changedOwnedProductionFiles']=changes
(D/'source-manifest.json').write_text(json.dumps(out,separators=(',',':')))
(D/'production.patch').write_text(''.join(patch))
print(json.dumps({'liveMatchesFinal':out['liveMatchesFinal'],'final':out['final']['simulationSha256'],'changedOwnedProductionFiles':changes}))

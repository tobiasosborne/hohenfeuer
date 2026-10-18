# owns: compact, deterministic pure-source packets needed to reproduce every measured condition.
from pathlib import Path
import json,tarfile,gzip,io,hashlib
D=Path(__file__).resolve().parent
manifest=json.loads((D/'source-manifest.json').read_text())
packets={}
for label,condition in [('baseline','baseline'),('frozen-ai','final'),('final-proxy','proxy-final')]:
 root=Path('/tmp/castle-wave3-'+condition)
 files=sorted(set(manifest[condition]['files'])|{'package.json','src/tb1-script.js','scripts/sweep.mjs','scripts/novice.mjs','scripts/critique-metrics.mjs'})
 buf=io.BytesIO()
 with tarfile.open(fileobj=buf,mode='w',format=tarfile.USTAR_FORMAT) as tar:
  for name in files:
   data=(root/name).read_bytes();info=tarfile.TarInfo(name);info.size=len(data);info.mtime=0;info.mode=0o644;tar.addfile(info,io.BytesIO(data))
 output=D/(label+'-sources.tar.gz')
 with output.open('wb') as f:
  with gzip.GzipFile(fileobj=f,mode='wb',mtime=0,filename='') as gz:gz.write(buf.getvalue())
 packets[label]={'file':output.name,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'simulationSha256':manifest[condition]['simulationSha256'],'files':len(files)}
(D/'source-packets.json').write_text(json.dumps(packets,separators=(',',':')))
print(json.dumps(packets))

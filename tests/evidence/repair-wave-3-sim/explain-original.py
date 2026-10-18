# owns: retained original scored tails and their command/position/idle/aim explanations.
import json,gzip
from pathlib import Path
D=Path(__file__).resolve().parent;P=D.parents[2];V=P/'tests/evidence/critique-v3'
scored=json.loads((V/'novice.json').read_text())['matches'];rows=[]
replays={(2,4):D/'novice-original-tails-matches/L2-s4-normal.json',(2,7):D/'novice-original-low-matches/L2-s7-normal.json',(2,10):D/'novice-original-low-matches/L2-s10-normal.json',(5,10):D/'novice-original-upper-fast-matches/L5-s10-normal.json'}
for r in scored:
 if r['reason']!='timeout' and r['seconds']>=480:continue
 key=(r['level'],r['seed']);trace=f'tests/evidence/critique-v3/traces/L{key[0]}-seed{key[1]}.json.gz'
 commands=json.loads(gzip.decompress((P/trace).read_bytes()))
 replay=json.loads(replays[key].read_text()) if key in replays else None
 if replay:assert replay['hash']==r['hash']
 first=r['shotEvents'][0]['second'];last=r['shotEvents'][-1]['second']
 row={k:r[k] for k in ['level','seed','seconds','reason','winner','hash','shots','firstHitS','firstPalaceS','commandCounts']}
 row.update({'originalCommandTrace':trace,'target':'initial enemy palace centre; supplied rounded bearing and charge100, bounded impact correction, no solver','aims':sorted({(s['aim']['az'],s['aim']['range']) for s in r['shotEvents']}),'firstShotS':first,'lastShotS':last,
 'firstCommands':commands[:1],'lastFireCommands':[c for c in commands if c['type']=='fire'][-3:],'endGunState':r['audit']['final']['weapons'],'endRulerState':r['audit']['final']['ruler']})
 if replay:row.update({'replay':str(replays[key].relative_to(P)),'hashReproduced':True,'positionIdleMilestones':replay['audit']['snapshots']})
 if key==(5,6):row.update({'class':'interrupted-repair-memory-defect','causalTrace':'tests/evidence/critique-v3/interruption-trace.json','sequence':{'lastShotS':162.03333333333333,'leaveS':168,'repairS':169,'warningS':169.06666666666666,'returnedControlMansS':175.43333333333334},'explanation':'The warning arrives while unmanned, copies null manning and clears pending repair/gun memory. No MAN follows the evasion. Original capped beside a healthy, crewed, supplied, ready gun; the one-line control resumes but ends597.3s, still below12min.'})
 elif key==(2,7):row.update({'class':'interrupted-repair-memory-defect','sequence':{'lastShotS':393.03333333333336,'leaveS':396,'repairS':397,'warningS':397.06666666666666,'readySnapshotS':481,'nextShotS':1171.0333333333333,'replacementOrderS':1150.0333333333333},'explanation':'The same null-gun interruption occurs397.07s. At481s the selected gun is ready, supplied and crewed while the ruler is unmanned at its operator point. Repeated local repairs continue. Both original guns are lost much later; a paid replacement is ordered1150s and fires1171s, too late for the observation cap. The original long drought is not initially a path or weapon-loss defect.'})
 else:row.update({'class':'legitimate-fast-palace-exchange','explanation':'Continuous paid fire, approximately21s volleys and bounded lateral correction hit the same enemy keep. Charge stays100. The early palace defeat line is crossed after18 or21 shots. No forgotten healthy gun or extended navigation silence explains this fast finish; the supplied favourable opening and sustained accuracy are a balance/proxy limit.'})
 rows.append(row)
assert len(rows)==5
(D/'original-tail-explanations.json').write_text(json.dumps({'originalScoredCohortRetained':'tests/evidence/critique-v3/novice.json','cases':rows},separators=(',',':')))
print('Explained all five original timeout/sub8min cases; four exact full replay hashes and the retained seed6 causal control.')

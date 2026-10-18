# owns: scoped wave-three cohort gates, retained originals and compact activity annotations.
import json, math, statistics, hashlib
from pathlib import Path
from collections import Counter
D=Path(__file__).resolve().parent
ROOT=D.parents[2]
V3=ROOT/'tests/evidence/critique-v3'
def read(p):
    return json.loads(p.read_text())
def rows(label,sweep=False):
    p=D/(('sweep-' if sweep else '')+label+'.json')
    if p.exists(): return read(p)['matches'],True
    p=D/(('sweep-' if sweep else '')+label+'-partial.json')
    return (read(p),False) if p.exists() else ([],False)
def quantile(a,q):
    a=sorted(a);i=(len(a)-1)*q;lo=math.floor(i);hi=math.ceil(i)
    return a[lo]+(a[hi]-a[lo])*(i-lo) if a else None
def stats(rr,novice=False):
    if not rr:return {'n':0}
    winner=lambda r:r.get('winner') if novice else r.get('winnerSlot')
    reason=lambda r:r.get('reason') if novice else r.get('eliminationReason')
    lengths=[r['seconds'] for r in rr]
    losses=[r['lowMotion'][1-winner(r)] for r in rr if winner(r) in [0,1] and 'lowMotion' in r]
    first=[r for r in rr if winner(r) in [0,1] and r.get('firstGunLoss') and not r['firstGunLoss'].get('simultaneous')]
    physical=lambda r:(1-winner(r) if r.get('swap') else winner(r)) if winner(r) is not None else None
    return {'n':len(rr),'independentSeeds':sorted({r['seed'] for r in rr}),'in12to20':sum(r.get('outcome') is not None and 720<=r['seconds']<=1200 for r in rr),
      'timeouts':sum(r.get('outcome') is None for r in rr),'draws':sum(bool(r.get('outcome',{}).get('draw')) for r in rr if r.get('outcome') is not None),'minP10MedianP90MaxS':[quantile(lengths,q) for q in [0,.1,.5,.9,1]],'sdS':statistics.pstdev(lengths),
      'endings':dict(Counter(reason(r) or 'timeout' for r in rr)),'slotWins':[sum(winner(r)==i for r in rr) for i in [0,1]],
      'physicalWestEastWins':[sum(physical(r)==i for r in rr) for i in [0,1]],'wins':sum(winner(r)==0 for r in rr) if novice else None,
      'firstGunLosses':len(first),'firstGunComebacks':sum(winner(r)==r['firstGunLoss']['slot'] for r in first),
      'losingPalaceLowMotion':{'samples':len(losses),'over180S':sum(s>180 for s in losses),'maxS':max(losses,default=None),'medianS':statistics.median(losses) if losses else None},
      'latestFirstShotS':max((s['firstShotS'] for r in rr for s in r.get('sides',[]) if s.get('firstShotS') is not None),default=None),
      'maxActualFireGapS':max((s['longestNoFireS'] for r in rr for s in r.get('sides',[])),default=None),
      'maxReadyFireGapS':max((s['longestReadyNoFireS'] for r in rr for s in r.get('sides',[])),default=None),
      'intentionalRulerEndings':sum(e.get('targetKind')=='ruler' for r in rr for e in r.get('rulerIntent',[])),
      'collateralRulerEndings':sum(e.get('targetKind')!='ruler' for r in rr for e in r.get('rulerIntent',[]))}
def write(name,value):
    b=json.dumps(value,separators=(',',':')).encode();assert len(b)<2_000_000,(name,len(b));(D/name).write_bytes(b)
base=read(V3/'sweep-focal.json')['matches']
originalNovice=read(V3/'novice.json')['matches']
result={'method':'summarize.py; 20-minute censoring; strict post120s loser-only low-motion; paired slot orders are not independent worlds',
 'original':{'focal':stats(base),'novice':{str(l):stats([r for r in originalNovice if r['level']==l],True) for l in [2,5,8]}},'cohorts':{}}
for label,sweep in [('events-only',True),('throne-heldout',True),('throne-skill-heldout',True),('focal-final',False),('ai3-final',True),('novice-fixed',False),('plateau-baseline',False)]:
    rr,complete=rows(label,sweep);entry={'complete':complete,'summary':stats(rr,label=='novice-fixed')}
    if label=='events-only':
        bb={(r['seed'],r['swap']):r for r in base};entry['exactOriginalHashMatches']=sum(r['hash']==bb[(r['seed'],r['swap'])]['hash'] for r in rr)
    if label=='novice-fixed':entry['perCohort']={str(l):{part:stats([r for r in rr if r['level']==l and ((r['seed']<=10)==(part=='reproduction'))],True) for part in ['reproduction','heldout']} for l in [2,5,8]}
    if label=='throne-skill-heldout':entry['perAssignment']={','.join(map(str,levels)):{'summary':stats([r for r in rr if r['physicalLevels']==levels]),'ai8Wins':sum(r['physicalLevels'][(1-r['winnerSlot']) if r['swap'] else r['winnerSlot']]==8 for r in rr if r['physicalLevels']==levels and r['winnerSlot'] is not None)} for levels in [[3,8],[8,3]]}
    result['cohorts'][label]=entry
write('acceptance-progress.json',result)
annotations=[]
for label in ['plateau-baseline','focal-final']:
    for p in sorted((D/(label+'-matches')).glob('*.json')):
        r=read(p);loser=1-r['winnerSlot'] if r['winnerSlot'] in [0,1] else None
        if loser is None:continue
        windows=r['audit']['plateaus'][loser]['windows']
        for w in windows:
            during=lambda e:w['startS']<=e['second']<=w['endS']
            w['gunLosses']=sum(e['slot']==loser and during(e) for e in r.get('gunLossEvents',[]))
            w['rulerWarnings']=sum(e['castle']==loser and during(e) for e in r.get('threatEvents',[]))
            w['enemyRulerTargetedShots']=sum(e['slot']!=loser and e['target']=='ruler' and during(e) for e in r['audit']['launches'])
            w['rulerRouteChanges']=sum(e['slot']==loser and during(e) for e in r['audit']['route'])
        measured=max((w['seconds'] for w in windows),default=0)
        assert measured==r['lowMotion'][loser] or r['lowMotion'][loser]<=180,(p,measured,r['lowMotion'])
        annotations.append({'condition':label,'seed':r['seed'],'level':r['level'],'swap':r['swap'],'loserSlot':loser,'hash':r['hash'],'seconds':r['seconds'],
          'windows':windows,'deadWindowsOverHalfInactive':sum(w['inactiveShare']>.5 for w in windows),'repairExamples':r['audit']['repairBeats']})
write('plateau-annotations.json',{'definition':'Post120s; entire max-minus-min strictly below .02; all maximal windows >180s; eventual losers only. Firing means an actual shot in the preceding30s; crises and repair assignment are separate from repairHP.', 'matches':annotations})
print(json.dumps({k:{'complete':v['complete'],'n':v['summary']['n']} for k,v in result['cohorts'].items()}))

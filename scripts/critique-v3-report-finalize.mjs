// owns: filling the independently judged scorecard, ranked issue table and exact fifteen-line summary in critique v3.
import {readFileSync,writeFileSync} from 'node:fs';
const dir='tests/evidence/critique-v3',path='research/22-gameplay-critique-v3.md';let s=readFileSync(path,'utf8');if(!s.includes('<!-- v3-scorecard -->'))throw Error('Report already finalized; do not append duplicate sections');
const rows=[
 ['Shot-cycle clarity',3,3,4,false,'H,S: 20 cannon, 20 catapult and 20 cleared-ballista captions have correct signed offsets; seven stress-shot exits lack feedback and precise convergence remains open.'],
 ['Decision density',2,3,3,true,'H: 605 reloads use 1.00/1.01/1.13 non-aim types; only 91 show an alternative and 21/209 beneficial planner-best choices are displayed.'],
 ['Interesting trade-offs',2,3,3,false,'H: turtle and pressure win 7/10 versus fire-only 6/10; ballista spam wins 1/10; this finite screen establishes no dominant plan.'],
 ['Role load balance',2,2,2,true,'H: the instructed proxy uses repair and movement inside reloads; fire-only still wins 6/10, while human foreman/commander workload is unmeasured.'],
 ['Match shape',2,3,3,true,'H,S: focal losing-palace plateaus remain 34/40, max332s; AI3 has20/20, max700s; the visible defeat line does not establish a felt arc.'],
 ['Length and variance',4,2,3,true,'H: AI pacing is123/150 in range with no timeout, but the defined novice is14/30 with two censors; the repaired-memory control still ends at9:57.'],
 ['Comeback vs snowball',2,4,4,false,'H: first damaging attacker wins13/20; first-gun-loss recovery is1/4 worlds, with one terminal first-loss case and no broad low-morale-comeback proof.'],
 ['Quiet beats',3,3,3,true,'H,S: 46.1 repairs/side and an actual paid repair beat exist, but gun-facing timelines conceal most masonry and felt recovery is untested.'],
 ['First-match onboarding',2,3,3,true,'D,H,S: all offered duels are armed and80/80 AI starts fire by20.57s; six onboarding checks pass, but supplied routes do not prove unbriefed completion.'],
 ['Signalling over text',3,3,3,true,'D,S: E/R cues, diagnostics and progress work; the real-view sample has0 two-option windows and no evidence that newcomers discover most verbs.'],
 ['Rule consistency',3,3,3,true,'D,S: the palace line reads20/20/28.7/55 correctly; pre-population-loss screens still advertise only the20%-morale trigger.'],
 ['Complexity ramp',2,4,4,false,'D,S: cannon/stone first, R2, G3, F4, Q/X5 and the full arsenal by10; profile0/3/10 browser checks preserve the small opening surface.'],
 ['Impact/distance readability',3,3,4,true,'H,S: wall/palace/person classification, retained references and73 correct observed captions improve feedback; distant detail, audio and precise aiming remain unvalidated.'],
 ['Threat telegraphing',2,2,4,true,'H,S: the seed6 cue leads death by2.97s; all10 focal ruler deaths have matching warnings, with2.90–3.37s lead.'],
 ['NPC legibility',2,2,4,true,'D,S: all seven live-simulator idle fixtures match their HUD diagnosis or intentional reload/ready suppression; unbriefed diagnosis remains U.'],
 ['HUD and alert hygiene',3,4,4,false,'D,S: bounded messages, at most two choices and staged controls remain; AI-watch screenshots still advertise inactive WASD/Q/X footer actions.'],
 ['Economy scarcity',1,3,3,false,'H: all requested AI cohorts spend zero time at cap; focal near-zero time is only0.139%, versus19.26% in desert, so scarcity remains scenario-dependent.'],
 ['Repair vs rebuild loop',3,3,4,true,'D,S: real R repairs24→25→40HP for1.28g with priority3 and visible progress; the initial60%-HP wall is above the automatic repair threshold.'],
 ['Morale design',2,2,3,true,'H,S: the novice has14 morale-clock surrenders and one population surrender; real45s progress and pressure causes are legible, but recovery comprehension is U.'],
 ['Win-path variety',2,1,4,true,'H: focal26/10/4 includes eight leadership-exposed ruler records; pressure creates R/S wins, while other biomes remain29/30 palace and sniping-first finds no target.'],
 ['AI as opponent',2,2,3,true,'D,H: AI3 ready silence falls to42.5s and all biomes fire; both skill orientations favor AI8, but ruler returns and asymmetric starting breach plans remain flawed.'],
 ['Fair failure and replay',2,2,4,true,'D,S: real losses name cause/source/time, retain decisive events and support same-setup Enter retry; perceived fairness and a difficulty-ladder recommendation remain unproved.']
];
const groups=[['A',0,4,20],['B',4,8,20],['C',8,12,20],['D',12,16,20],['E',16,20,20],['F',20,22,10]];
const totals=[1,2,3].map(col=>rows.reduce((n,r)=>n+r[col],0));if(rows.length!==22||totals.join()!=='52,60,75')throw Error('Score arithmetic');
writeFileSync(`${dir}/scorecard.json`,JSON.stringify({totals,groups:groups.map(([group,start,end,max])=>({group,max,scores:[1,2,3].map(c=>rows.slice(start,end).reduce((n,r)=>n+r[c],0))})),criteria:rows.map((r,i)=>({number:i+1,criterion:r[0],v1:r[1],v2:r[2],v3:r[3],humanUnvalidated:r[4],evidence:r[5]}))},null,2));
const table=['U flags the human-dependent part of a criterion. Numeric grades are supported technical/proxy judgments on the same scale as v1/v2; they are not claims that the U acceptance has passed.','', '| # | Criterion | v1 | v2 | v3 | Human | One line of evidence |','|---|---|---:|---:|---:|:---:|---|',...rows.map((r,i)=>`| ${i+1} | ${r[0]} | ${r[1]} | ${r[2]} | **${r[3]}** | ${r[4]?'U':'—'} | ${r[5].replace(/(\d)([A-Za-z])/g,'$1 $2')} |`),'', '**A 12/20, B 13/20, C 13/20, D 16/20, E 14/20, F 7/10 = 75/110.** No A/D/F criterion is at1. The rubric band is “promising, specific rework required.”','', 'Two lane-provisional grades are not adopted: **B6 stays3 rather than research/20’s4**, because individual player-proxy and AI8 pacing gates remain weaker than the pooled AI result; the proxy bug is separated from actual game balance. **C11 stays3 rather than research/21’s4**, because an accurate palace clock does not reveal the separate population loss condition. The UI’s A1/D13=4 remains an intermediate grade: observed offsets are correct, but missing long-miss feedback and unproved chosen-point convergence prevent5. E18=4 is supported by actual paid progress above the automatic-repair threshold, without claiming human uptake.','', 'The strongest changes are broad AI/start reliability, attributable danger and failure, and visible repair/defeat-clock feedback. The largest remaining gains are meaningful use of existing reload choices, usable aiming across normal hits and long misses, and unbriefed discovery. Adding verbs is not supported by this evidence.'].join('\n');
s=s.replace('<!-- v3-scorecard -->',table);
const issues=JSON.parse(readFileSync(`${dir}/issues.json`));
const repairRows=['| Rank / Bead | Criterion; expected points | Lane | Measurable acceptance |','|---|---|---|---|',...issues.map(r=>`| ${r.rank}. \`${r.id}\` — ${r.title} | ${r.criterion}; ${r.points} | ${r.lane} | ${r.acceptance} |`),'', 'The physical-side and leader-return items share at most one F21 point. The reload item can add A2/A4 points; an additional E18 point needs demonstrated prioritisation/reward. The three largest available gains are therefore **reload/role/repair quality, up to+3; aiming/readability,+2; onboarding/discovery,+2**. These are conditional future gains, not credit awarded to proposed changes. [Filed descriptions](../tests/evidence/critique-v3/issues.json).'].join('\n');
s=s.replace('<!-- v3-repairs -->',repairRows);
s=s.replace('Measurement draft, 2026-10-18. The remaining cohorts are running; the final verdict and complete scorecard will replace this opening once those measurements finish.', '**2026-10-18: 75/110, up from 60/110 and 52/110. The 70-point target is cleared by five points.** Feedback and functional reliability improve substantially. Meaningful reload guidance and unbriefed play remain unvalidated; this is an instrumented critique, not a human-play certification.');
s=s.replace('The detailed ending audit covers every non-palace focal case:', 'The detailed ending audit covers every non-palace focal case:');
s=s.replace('gun abandoned, ruler remains at the front','no longer manning, ruler remains at the front').replace('gun abandoned, ruler still at front','no longer manning, ruler still at front');
s=s.replace('All four focal surrenders are population-triggered.', 'Dominant pressure below means the largest current harmful diagnostic weight, not an integrated causal share of morale loss.\n\nAll four focal surrenders are population-triggered.');
const extra="The 15 proxy surrenders comprise **14 morale-clock cases and one population case**. Dominant current pressure is **palace damage in eight and losses in seven**. The per-case trigger, weight and produced pressure text are listed in [the ending ledger](../tests/evidence/critique-v3/novice-ending-quality.json). Seven are enemy surrenders after a player win: their pressure is not on the local player's morale line, and the winning screen has no cause account. The eight local surrender losses have the local pressure surface and loss account. An actual AI2 seed3 replay shows **losses / surrender 44/45 s**, morale11%, population15 (above14), and palace96.2% before surrender; its final browser hash matches the scored proxy. This is a distinct morale defeat, not population or palace defeat. [Actual clock](../tests/evidence/critique-v3/shots/morale-clock-last.png), [replay](../tests/evidence/critique-v3/morale-browser.json).\n\nAll seven morale-pressure victories were causally replayed with matching hashes. The four ruler deaths all follow AI leadership excursions: seed1 is manning the front gun, seed2 is no longer manning it, seed5 falls, and seed9 is walking to a rear gun. The three surrender wins, seeds3/7/8, are population-triggered at12/11/12 survivors; losses dominate with weights−0.825/−1.0375/−0.825. None is a morale-clock victory. This supports a people-attrition plan, with several different formal endings, and qualifies the meaning of its7/10 win rate. [Strategy ending audit](../tests/evidence/critique-v3/strategy-quality.json).\n\n";
s=s.replace('All environment controls pair the same',extra+'All environment controls pair the same');
s=s.replace('`.19` remains open with corrected notes. [Metric audit]', '`.19` remains open with corrected notes. Outside the focal cohort, AI3 still has20/20 losing-side spans over three minutes; seed3 reaches700 seconds in both orders. Focal improvement does not clear the broader shape problem. [Metric audit]');
s=s.replace('<!-- v3-verification-final -->',"All 306 source files and the two baseline driver scripts are unchanged. Every JSON evidence file is below2 MB. No golden was replaced. Diagnostic fixture pilots and the first screenshot timeout are retained separately; they are not counted as passes or games. No git command or Dolt push was run. `castle-game-uo7.18` and `.19` remain open with the new diagnosis/corrected metric; `.21`–`.28` own the ranked repairs. `castle-game-uo7.20` is completed by this report and the new top section of `HANDOFF.md`.");
const summary=[
 'Total:75/110 (+15 from v2); target70 exceeded by5.',
 'A — Loop and decisions:12/20.',
 'B — Pacing:13/20.',
 'C — Onboarding and discovery:13/20.',
 'D — Feedback and legibility:16/20.',
 'E — Systems:14/20.',
 'F — Opponent and failure:7/10.',
 'Focal:26 palace /10 ruler /4 surrender;0 timeouts;36/40 in range.',
 'Physical wins:12 west /28 east; full authored mirror gives9/11 over20 worlds.',
 'Novice wins versus2/5/8:8/10,4/10,5/10; only14/30 matches in range.',
 'Reloads:605;91 one-option views,0 two-option views;21/209 beneficial best choices shown.',
 'Largest available gain: existing reload/role/repair choices, up to+3.',
 'Next available gain: aiming and impact readability,+2.',
 'Next available gain: unbriefed onboarding/discovery,+2.',
 'Unmeasured: human comprehension, workload, felt recovery, audio, fairness and unconstrained strategy quality.'
];
s=s.replace('<!-- v3-summary -->',summary.map((x,i)=>`${i+1}. ${x.replace(/([,:]|\bup to|\btarget)(\d)/g,'$1 $2').replace(/(\d)([A-Za-z])/g,'$1 $2')}`).join('\n'));
// Keep prose readable where generated numeric evidence is compact.
s=s.replace(/\b(by|at|from|above|below|within|over|than|with|of|for|only|is|are|has|gives|versus|at least|to)(\d)/g,'$1 $2');
writeFileSync(path,s);console.log('wrote scorecard and final report: 75/110');

// owns: in-memory observation hooks around the unchanged v2 sweep and novice scripts.
import {registerHooks} from 'node:module';
const sweep=new URL('./sweep.mjs',import.meta.url).href,novice=new URL('./novice.mjs',import.meta.url).href;
const changes={
 [sweep]:[
 ['export function runMatch(job, onProgress = () => {}) {','export function runMatch(job, onProgress = () => {}, audit = {}) {'],
 ['C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();','C.resetRegistriesForTests(); registerCoreSim(); audit.register?.(); C.freezeRegistries();'],
 ['const map = { ...base, slots: job.swap ? [...base.slots].reverse() : [...base.slots] };','const map = { ...base, slots: job.swap ? [...base.slots].reverse() : [...base.slots] }; audit.map?.(map);'],
 ['onReady(a) { api = a; }, onStage(stage)','onReady(a) { api = a; audit.setup?.(a); }, onStage(stage)'],
 ['minuteCurve.push(record());\n  for','minuteCurve.push(record()); audit.start?.(api.state, sim);\n  for'],
 ['const events = sim.drainEvents(), losses = [];','const events = sim.drainEvents(), losses = []; audit.tick?.(state, events, sim);'],
 ['return { ...job, fireGaps','audit.end?.(state, sim); return { ...job, fireGaps'],
 ],
 [novice]:[
 ["reactToThreats=true}) {","reactToThreats=true,policyFactory=createPolicy,audit={}}) {"],
 ['const p=createPolicy(sim.state,policy,','const p=policyFactory(sim.state,policy,'],
 ['const threats=[],deaths=[]','audit.start?.(api.state,sim,p);\n  const threats=[],deaths=[]'],
 ['paths.sample(api.state,events);','paths.sample(api.state,events); audit.tick?.(api.state,events,sim,p,cmds);'],
 ['const s=api.state, valid=windows.filter(w=>w.endS-w.startS>=10);','const s=api.state, valid=windows.filter(w=>w.endS-w.startS>=10); audit.end?.(s,sim,p,valid);'],
 ['if(!isMainThread&&workerData){','if(!isMainThread&&workerData===true){'],
 ]
};
registerHooks({load(url,ctx,next){const r=next(url,ctx);if(!changes[url])return r;let source=String(r.source);for(const [a,b]of changes[url]){if(!source.includes(a))throw Error('Baseline script changed; missing hook '+a);source=source.replace(a,b);}return {...r,source};}});
const s=await import('./sweep.mjs'),n=await import('./novice.mjs');
export const runMatch=s.runMatch,runNovice=n.runNovice,createPolicy=n.createPolicy;

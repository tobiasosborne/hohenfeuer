// owns: run existing browser and golden gates with all generated output confined to critique-v3.
import {registerHooks} from 'node:module';
import {mkdirSync} from 'node:fs';
const name=process.argv[2],dir='tests/evidence/critique-v3';
const targets={browser:'tests/browser.mjs',flow:'tests/ui-flow.mjs',onboarding:'tests/ui-onboarding.mjs',actions:'tests/ui-repair-actions.mjs',palace:'tests/ui-repair-palace.mjs',warning:'tests/ui-repair-replay.mjs',goldens:'scripts/goldens.mjs'};
if(!targets[name])throw Error(name);
mkdirSync(`${dir}/${name}`,{recursive:true});
process.env.UI_EVIDENCE_DIR=`${dir}/onboarding`;
registerHooks({load(url,context,next){const r=next(url,context);if(url.endsWith('/'+targets[name])){
 let text=String(r.source).replaceAll('"test-results"',JSON.stringify(`${dir}/${name}`)).replaceAll("'tests/evidence/repair-wave-2-ui'",JSON.stringify(`${dir}/${name}`));
 if(name==='warning')text=text.replace("createPolicy(sim.state,'novice')","createPolicy(sim.state,'novice',{reactToThreats:false})");
 if(name==='palace')text=text.replace('const reached=await page.evaluate(t=>window.__hohenfeuer.stepTo(t),next);', 'const reached=await page.evaluate(t=>{window.__hohenfeuer.stepTo(t);return window.__hohenfeuer.state.tick;},next);');
 if(name==='goldens')text=text.replace('await writeFile(goldenPath, shot);','throw new Error(`Missing baseline ${goldenPath}; critique never replaces goldens`);');
 return {...r,source:text};}return r;}});
await import(new URL('../'+targets[name],import.meta.url));

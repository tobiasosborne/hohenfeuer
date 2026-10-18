// owns: contextual battle feedback drawing in the existing 1024x768 HUD viewport.
import { t } from './i18n.js';
import { drawText, drawTextIn, measure } from './font.js';
import { threatEdge, battlePercent } from './battle-feedback.js';

function line(ctx,text,y,note,color='#fff0c0') {
  const width=Math.min(792,measure(text,{bold:true,outline:true}).w+24);
  ctx.fillStyle='rgba(12,16,20,.9)';ctx.fillRect(512-width/2,y,width,26);
  drawTextIn(ctx,text,{x0:512-width/2+8,y0:y,x1:512+width/2-8,y1:y+26},{bold:true,color});note(text);
}
function cross(ctx,p,color,ring=false) {
  if(!p)return;
  const [x,y]=p;ctx.strokeStyle='#101418';ctx.lineWidth=4;
  const shape=()=>{ctx.beginPath();if(ring)ctx.arc(x,y,8,0,Math.PI*2);else{ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);}ctx.stroke();};
  shape();ctx.strokeStyle=color;ctx.lineWidth=2;shape();
}
export function drawBattleFeedback(ctx,v,note=()=>{}) {
  if(v.menu)return;
  const lang=v.lang??'de';
  if(v.palace) {
    const {integrity,threshold,repair}=v.palace,x=302,y=v.populationWarning&&v.pressure?127:105,w=420;
    const text=t('palaceBar',lang,{pct:battlePercent(integrity),line:battlePercent(threshold)});
    ctx.fillStyle='rgba(12,16,20,.9)';ctx.fillRect(x-8,y-23,w+16,repair?57:39);
    drawText(ctx,text,512,y-17,{align:'center',bold:true,color:'#fff0c0'});note(text);
    ctx.fillStyle='#343b42';ctx.fillRect(x,y,w,8);
    ctx.fillStyle=integrity-threshold<.1?'#f06a44':'#73b9a1';ctx.fillRect(x,y,Math.round(w*integrity),8);
    ctx.fillStyle='#e94c36';ctx.fillRect(x,y,Math.round(w*threshold),8);
    ctx.fillStyle='#fff3c5';ctx.fillRect(x+Math.round(w*threshold)-1,y-3,2,14);
    if(repair) {
      const rx=x+Math.round(w*integrity);
      ctx.lineWidth=3;ctx.strokeStyle='#132923';ctx.beginPath();ctx.arc(rx,y+4,7,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#bbf6cf';ctx.beginPath();ctx.arc(rx,y+4,7,-Math.PI/2,-Math.PI/2+2*Math.PI*repair.progress);ctx.stroke();
      const label=t('palaceRepair',lang,{pct:Math.round(repair.progress*100)});
      drawText(ctx,label,512,y+17,{align:'center',color:'#bbf6cf',bold:true});note(label);
    }
  }
  if(v.pressure) {
    ctx.fillStyle='rgba(12,16,20,.86)';ctx.fillRect(470,57,334,21);
    drawTextIn(ctx,v.pressure,{x0:474,y0:57,x1:800,y1:78},{color:'#f2c273',bold:true});note(v.pressure);
  }
  if(v.populationWarning) {
    const y=v.pressure?78:57;
    ctx.fillStyle='rgba(12,16,20,.86)';ctx.fillRect(470,y,334,21);
    drawTextIn(ctx,v.populationWarning,{x0:474,y0:y,x1:800,y1:y+21},{color:'#ffcf9b',bold:true});note(v.populationWarning);
  }
  if(v.danger) {
    const edge=threatEdge(v.danger.bearing??v.heading,v.heading??0);
    ctx.save();ctx.translate(edge.x,edge.y);ctx.rotate(edge.angle);
    ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(-12,11);ctx.lineTo(0,5);ctx.lineTo(12,11);ctx.closePath();
    ctx.fillStyle='#ffb85b';ctx.fill();ctx.strokeStyle='#611d12';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    line(ctx,v.danger.text,191,note,'#ffcd9b');
  }
  if(v.impactFeedback)line(ctx,v.impactFeedback,240,note,'#e7f6ff');
  if(v.aimReference) {
    cross(ctx,v.aimReference.aim,'#f4cf69');cross(ctx,v.aimReference.last,'#81d9ee',true);
    drawText(ctx,v.aimReference.text,512,514,{align:'center',bold:true,outline:true,color:'#f4cf69'});note(v.aimReference.text);
    if(v.mode==='impact'){const legend=t('aimLegend',lang);drawText(ctx,legend,512,532,{align:'center',outline:true,color:'#81d9ee'});note(legend);}
  }
  for(const job of v.danger||v.impactFeedback?[]:v.work??[]) {
    const [x,y]=job.screen,pct=Math.round(Math.max(0,Math.min(1,job.progress))*100);
    const text=t(job.kind==='repair'?(job.active?'repairProgress':'repairQueued'):'buildProgress',lang,{pct});
    ctx.fillStyle='rgba(12,16,20,.9)';ctx.fillRect(x-62,y-32,124,30);
    drawText(ctx,text,x,y-29,{align:'center',color:'#bfe7ac',outline:true});note(text);
    ctx.fillStyle='#36413a';ctx.fillRect(x-50,y-11,100,5);ctx.fillStyle='#9fd58c';ctx.fillRect(x-50,y-11,pct,5);
  }
  if(v.guidance) {
    for(const [i,m]of (v.guidance.markers??[]).entries()) {
      cross(ctx,m.screen,'#ffdb84');drawText(ctx,String(m.number??i+1),m.screen[0]+12,m.screen[1]-8,{bold:true,outline:true,color:'#ffdb84'});
    }
    if(v.guidance.leave)line(ctx,t('leaveForOrder',lang),396,note);
    v.guidance.lines.slice(0,2).forEach((text,i)=>line(ctx,text,426+i*28,note));
  }
}

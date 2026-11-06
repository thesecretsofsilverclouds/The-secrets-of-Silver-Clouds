/* A gift around the drink. No network, storage or automatic receipts. */
(function(root){
  'use strict';
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function sealedMarkup(drink,{name=drink.to||'For you',empty=false}={}){
    const neutral={...drink,ingredients:[]};
    return `<div class="sealed-glass ${empty?'returned-glass':''}" data-vessel="${E(drink.glass)}"><div class="sealed-aura"></div>${root.SoulSipGlass.render(neutral,{labels:false})}${empty?'':`<span class="seal-thread"></span><span class="soul-seal" aria-hidden="true">✦</span><span class="glass-name-tag"><small>KEPT FOR</small><strong>${E(name)}</strong></span>`}<span class="glass-counter-light"></span></div>`;
  }
  function invitationWords(drink){
    const to=drink.to?`${drink.to}, `:'';
    return `${to}I left something for you at the Sanctuary bar. Take your time with it.${drink.from?'\n— '+drink.from:''}`;
  }
  function recipeWords(drink,content){
    const words=['Zero','One','Two','Three','Four'];
    return drink.ingredients.map(i=>`${words[i.parts]} ${i.parts===1?'part':'parts'} ${content.ingredients.find(x=>x.id===i.id).name}`).join(', ')+'.';
  }
  function pourTime(meta,now=Date.now()){
    if(!meta||!Number.isSafeInteger(meta.pouredAt))return 'Kept behind the bar. Just for you.';
    const at=meta.pouredAt*60000,age=now-at;
    if(age<0||age>7*86400000)return 'Poured with you in mind. Kept behind the bar.';
    if(age<5*60000)return 'Poured a moment ago. Still cold.';
    const date=new Date(at),today=new Date(now),yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);
    const clock=date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
    return `Poured ${same(date,today)?'at':same(date,yesterday)?'yesterday at':date.toLocaleDateString('en-GB',{weekday:'long'})+' at'} ${clock}. Still cold.`;
  }
  function visiblePause(milliseconds,valid=()=>true){
    return new Promise(resolve=>{let elapsed=0,last=performance.now();const visibility=()=>{last=performance.now();};document.addEventListener('visibilitychange',visibility);const step=()=>{const now=performance.now();if(!document.hidden)elapsed+=Math.min(300,now-last);last=now;if(!valid()||elapsed>=milliseconds){document.removeEventListener('visibilitychange',visibility);resolve(valid());return;}setTimeout(step,100);};setTimeout(step,100);});
  }
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function saveSealed(drink){
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');
    const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#1b263d');bg.addColorStop(.65,'#080e18');bg.addColorStop(1,'#262031');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    const halo=ctx.createRadialGradient(540,650,10,540,650,430);halo.addColorStop(0,'#b99ad433');halo.addColorStop(1,'#b99ad400');ctx.fillStyle=halo;ctx.fillRect(0,0,1080,1350);
    ctx.strokeStyle='#d8bd8155';ctx.lineWidth=2;ctx.strokeRect(42,42,996,1266);ctx.textAlign='center';ctx.fillStyle='#d9bd8b';ctx.font='18px sans-serif';ctx.fillText('A GLASS KEPT AT THE SANCTUARY',540,114);
    const art=new Image();art.src=root.SoulSipGlass.artPath(drink.glass);await art.decode();ctx.drawImage(art,250,245,580,580);
    ctx.strokeStyle='#d4b77c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(470,425);ctx.quadraticCurveTo(665,430,785,660);ctx.stroke();
    ctx.save();ctx.translate(748,652);ctx.rotate(.12);ctx.fillStyle='#d9c398';ctx.fillRect(-122,-51,244,112);ctx.fillStyle='#342d2c';ctx.font='15px sans-serif';ctx.fillText('KEPT FOR',0,-18);ctx.font='25px Georgia';const name=drink.to||'You';ctx.fillText(name,0,24,216);ctx.restore();
    ctx.beginPath();ctx.arc(540,455,35,0,2*Math.PI);ctx.fillStyle='#a87944';ctx.fill();ctx.strokeStyle='#eddbb2';ctx.stroke();ctx.fillStyle='#fff0ce';ctx.font='34px Georgia';ctx.fillText('✦',540,468);
    ctx.fillStyle='#f1e4ce';ctx.font='italic 47px Georgia';ctx.fillText(drink.to?`${drink.to}, this one’s for you.`:'Someone poured you something.',540,960,900);
    ctx.fillStyle='#bcae98';ctx.font='27px Georgia';ctx.fillText(drink.from?'— '+drink.from:'A little feeling, above London.',540,1020,900);
    ctx.font='22px sans-serif';ctx.fillStyle='#98a8bd';ctx.fillText('The contents stay between you and the glass.',540,1145);
    ctx.font='17px sans-serif';ctx.fillText('THE SECRETS OF SILVER CLOUDS',540,1255);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image unavailable');downloadBlob(blob,'A-sealed-glass-for-you.png');
  }
  root.SoulSipExchange=Object.freeze({sealedMarkup,invitationWords,recipeWords,pourTime,visiblePause,downloadBlob,saveSealed});
})(typeof window!=='undefined'?window:globalThis);

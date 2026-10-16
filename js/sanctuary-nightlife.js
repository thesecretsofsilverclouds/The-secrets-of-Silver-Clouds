/* Quiet, audio-clock-led room lighting; never intercepts or reroutes sound. */
(() => {
  'use strict';
  const host=document.querySelector('.ss-widget');
  const narration=host?.querySelector('.ss-room-track');
  if(!host||!narration||document.querySelector('.ss-nightlife-layer'))return;
  const music=document.querySelector('.ss-jukebox-track');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const base=['#9660df','#cb669f','#537fe4'];
  const layer=document.createElement('div');
  layer.className='ss-nightlife-layer';layer.setAttribute('aria-hidden','true');
  const beams=base.map((color,index)=>{
    const beam=document.createElement('i');beam.className=`ss-nightlife-beam ss-nightlife-beam-${index+1}`;
    beam.style.color=color;layer.append(beam);return beam;
  });
  const haze=document.createElement('i');haze.className='ss-nightlife-haze';layer.append(haze);
  const motes=document.createElement('div');motes.className='ss-nightlife-motes';
  for(let i=0;i<8;i++){
    const mote=document.createElement('i');
    mote.style.cssText=`--ss-mote-x:${8+(i*17)%84}%;--ss-mote-y:${18+(i*23)%73}%;--ss-mote-delay:${-i*4.7}s;--ss-mote-duration:${24+i*2.8}s`;
    motes.append(mote);
  }
  layer.append(motes);document.body.prepend(layer);document.body.classList.add('ss-nightlife-page');
  // These washes sit above each card's solid background, below all its content.
  // Artwork keeps its own opaque backing, so no beam is painted over a character.
  const interiorLights=[host,document.querySelector('.ss-after-hours')].filter(Boolean).map(surface=>{
    const wash=document.createElement('div');wash.className='ss-nightlife-interior-light';
    wash.setAttribute('aria-hidden','true');surface.prepend(wash);return wash;
  });
  const controls=[];
  for(const target of [document.querySelector('.ss-story-actions'),host.querySelector('.ss-bar-footer>div')].filter(Boolean)){
    const button=document.createElement('button');button.type='button';button.className='ss-lighting-control';
    button.addEventListener('click',()=>{enabled=!enabled;reconcile();});target.append(button);controls.push(button);
  }
  let enabled=true,active=false,away=false,frame=0,lastFrame=-Infinity;
  let data=null,loading=null,musicTrack=null,musicLevel=0,mixUntil=0,mixTimer=0;
  let themeKey='',lastEnergy=-1,lastPaintTime=-1;
  const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
  const motionAllowed=()=>!reduced.matches&&!host.classList.contains('ss-motion-off');
  const available=()=>enabled&&!document.hidden&&!away;
  const validColor=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
  function palette(){
    const time=Number(narration.currentTime)||0;
    if(music&&!music.paused&&!music.ended&&musicTrack)return musicTrack.palette?.filter(validColor).slice(0,3)||base;
    // A warm turn towards the dance floor, then silver-blue at the guardian's arrival.
    if(!narration.paused&&!narration.ended&&time>=165)return ['#8275d8','#668edb','#bb9c70'];
    if(!narration.paused&&!narration.ended&&time>=90)return ['#b66aba','#8272dc','#c5a36c'];
    return base;
  }
  function paintPalette(colors){
    const values=colors.length===3?colors:base,key=values.join('|');
    if(key===themeKey)return;themeKey=key;
    beams.forEach((beam,index)=>{beam.style.color=values[index];});
    haze.style.color=values[2];
    for(const wash of interiorLights){wash.style.setProperty('--ss-wash-first',values[0]);wash.style.setProperty('--ss-wash-second',values[1]);}
  }
  function loadData(){
    if(data)return Promise.resolve(data);
    if(loading)return loading;
    loading=(async()=>{
      const embedded=document.getElementById('ss-sanctuary-lighting-data');
      const value=embedded?JSON.parse(embedded.textContent):await fetch('/data/sanctuary-lighting.json?v=20261016-after-hours').then(response=>{if(!response.ok)throw Error('Lighting unavailable');return response.json();});
      if(!value||!Number.isFinite(value.step)||value.step<=0||!value.tracks)throw Error('Lighting unavailable');
      data=value;return data;
    })().catch(()=>null);
    return loading;
  }
  function source(){
    if(music&&!music.paused&&!music.ended&&!music.muted&&musicLevel>0&&musicTrack)return {audio:music,id:musicTrack.id};
    if(!narration.paused&&!narration.ended&&!narration.muted&&host.dataset.roomAudio==='playing')return {audio:narration,id:'narration'};
    return null;
  }
  function sample(id,time){
    const profile=data?.tracks?.[id];
    if(!profile||!Array.isArray(profile.energy)||!profile.energy.length)return .08;
    const position=Math.max(0,time/data.step),index=Math.floor(position),fraction=position-index;
    const left=Number(profile.energy[index])||0,right=Number(profile.energy[index+1])||0;
    return clamp(left+(right-left)*fraction,0,.76);
  }
  function setEnergy(value){
    value=Math.round(value*1000)/1000;
    if(value===lastEnergy)return;lastEnergy=value;layer.style.setProperty('--ss-nightlife-energy',String(value));
    for(const wash of interiorLights)wash.style.setProperty('--ss-nightlife-energy',String(value));
  }
  function settle(){
    cancelAnimationFrame(frame);frame=0;active=false;layer.dataset.active='false';
    for(const wash of interiorLights){wash.dataset.active='false';wash.style.setProperty('--ss-wash-travel','45%');}
    setEnergy(0);lastPaintTime=-1;
    beams.forEach(beam=>{beam.style.transform='';});
    if(performance.now()>=mixUntil)paintPalette(base);
  }
  function tick(now){
    frame=0;
    const current=source();
    if(!available()||!motionAllowed()||!current){settle();return;}
    // Ten small compositor updates per second; the audio clock remains authoritative.
    if(now-lastFrame>=100){
      lastFrame=now;const time=current.audio.currentTime||0;
      setEnergy(sample(current.id,time));
      if(Math.abs(time-lastPaintTime)>.06){
        lastPaintTime=time;
        beams.forEach((beam,index)=>{
          const angle=Math.sin(time/(11+index*4)+index*2.1)*(23-index*3);
          const shift=Math.sin(time/(22+index*5)+index)*12;
          beam.style.transform=`translateX(${shift.toFixed(2)}vw) rotate(${angle.toFixed(2)}deg)`;
        });
        for(const wash of interiorLights)wash.style.setProperty('--ss-wash-travel',`${(90+Math.sin(time/11)*95).toFixed(2)}%`);
      }
      if(now>=mixUntil)paintPalette(palette());
    }
    frame=requestAnimationFrame(tick);
  }
  function reconcile(){
    layer.hidden=!enabled;layer.dataset.reduced=String(!motionAllowed());
    for(const wash of interiorLights){wash.hidden=!enabled;wash.dataset.reduced=String(!motionAllowed());}
    for(const button of controls){
      button.textContent=`Lighting ${enabled?'on':'off'}`;
      button.setAttribute('aria-pressed',String(enabled));
      button.setAttribute('aria-label',`${enabled?'Turn off':'Turn on'} ambient nightclub lighting`);
    }
    if(!enabled){
      clearTimeout(mixTimer);mixUntil=0;
      if(host.classList.contains('ss-nightlife-mix'))host.classList.remove('ss-nightlife-mix');
      layer.classList.remove('ss-nightlife-mixing');
    }
    if(!available()||!motionAllowed()||!source()){settle();return;}
    active=true;layer.dataset.active='true';loadData();
    for(const wash of interiorLights)wash.dataset.active='true';
    if(!frame)frame=requestAnimationFrame(tick);
  }
  function mixLight(event){
    if(!enabled||!['pour','stir','taste'].includes(event.detail?.kind)||host.dataset.mode==='melters')return;
    const style=getComputedStyle(host);
    const a=style.getPropertyValue('--ss-accent').trim(),b=style.getPropertyValue('--ss-second').trim();
    if(!validColor(a)||!validColor(b))return;
    mixUntil=performance.now()+4300;paintPalette([a,b,palette()[2]||base[2]]);
    host.classList.add('ss-nightlife-mix');layer.classList.add('ss-nightlife-mixing');
    clearTimeout(mixTimer);mixTimer=setTimeout(()=>{
      mixUntil=0;host.classList.remove('ss-nightlife-mix');layer.classList.remove('ss-nightlife-mixing');
      paintPalette(source()?palette():base);
    },4350);
  }
  host.addEventListener('ss:bar-sound',mixLight);
  document.addEventListener('ss:jukebox-state',event=>{
    musicTrack=event.detail?.track||null;musicLevel=Number(event.detail?.volume)||0;
    if(performance.now()>=mixUntil)paintPalette(palette());reconcile();
  });
  for(const audio of [narration,music].filter(Boolean)){
    for(const type of ['play','playing','pause','ended','seeking','seeked','volumechange','error','emptied'])audio.addEventListener(type,reconcile);
  }
  new MutationObserver(reconcile).observe(host,{attributes:true,attributeFilter:['class','data-room-audio']});
  document.addEventListener('visibilitychange',reconcile);
  window.addEventListener('pagehide',()=>{away=true;settle();});
  window.addEventListener('pageshow',()=>{away=false;reconcile();});
  reduced.addEventListener('change',reconcile);
  paintPalette(base);reconcile();
})();

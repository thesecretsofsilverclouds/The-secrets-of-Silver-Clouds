(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const icons={
    cell:'<path d="M20 8h24v48H20zM27 4h10v4M24 15h16M24 49h16M32 23v16M26 31h12"/><path d="M15 18h5m24 0h5M15 45h5m24 0h5"/><rect x="24" y="19" width="16" height="26" rx="5" fill="currentColor" opacity=".09"/>',
    capacitor:'<path d="M19 11h26v43H19zM25 6h14v5M23 17h18M23 47h18M36 21l-10 12h9l-6 11 12-16H31z"/><path d="M12 19h7m26 0h7M12 44h7m26 0h7"/>',
    prism:'<path d="M32 7 53 43 32 57 11 43zM32 7v50M11 43h42M23 22l30 21M41 22 11 43"/><path d="M4 33h10m36 0h10"/><path d="M32 7 53 43 32 57z" fill="currentColor" opacity=".1"/>',
    regulator:'<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="15"/><path d="M32 17v5M17 32h5M42 32h5M32 42v5M32 32l9-8M26 53v6m12-6v6M4 32h6m44 0h6"/><circle cx="32" cy="32" r="3" fill="currentColor"/>',
    lens:'<path d="m18 12 28 0 10 20-10 20H18L8 32zM18 12l7 12h14l7-12M25 24l-7 28m21-28 7 28M8 32l17-8m14 0 17 8M18 52l14-10 14 10"/><circle cx="32" cy="33" r="9" fill="currentColor" opacity=".12"/><path d="M32 28v10m-5-5h10"/>',
    impeller:'<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="4"/><path d="M29 29C13 25 18 9 29 14c7 3 2 9 0 15ZM36 31c11-12 23-1 13 7-6 5-9-2-13-7ZM31 36c4 16-12 20-14 8-1-8 8-7 14-8Z" fill="currentColor" fill-opacity=".08"/>'
  };
  const icon=key=>`<svg viewBox="0 0 64 64" aria-hidden="true">${icons[key]||icons.cell}</svg>`;
  const labels={power:'Source',control:'Control',output:'Output'};
  const categories={lighting:'CARRIAGE COMFORT',window:'A CLEARER VIEW',announcement:'ONE CLEAR NOTE'};
  const indexTitles={lighting:'THE READING LIGHTS',window:'THE OBSERVATION WINDOWS',announcement:'THE NEXT-STOP CHIME'};
  const stats={power:'Drive',stability:'Stability',light:'Light',airflow:'Airflow',harmonics:'Harmonics'};
  const concise={
    'pulse-cell':'EVEN POWER','storm-capacitor':'EXTRA DRIVE','prism-coil':'FOCUSED LIGHT',
    'steady-regulator':'SMOOTH FLOW','lumen-lens':'GENTLE GLOW','air-impeller':'CLEARING BREEZE'
  };
  let busy=false,busyTimer=0,toastTimer=0,destroyed=false,state=null,crew=null,transit=null,living=null,salvageBusy=false,dragging=false;
  let hatchGeometry=null,fixtureObserver=null;
  const HATCH={x:548,y:606,width:141,height:59,artWidth:1672,artHeight:941};
  let soundEnabled=false,audioContext=null,humGain=null,humOscillators=[],motorWobble=null;
  let transitSpeed=0,soundRequest=0;
  const phaseVoices=new Set();
  let motion=true,manualMotion=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  try{const saved=localStorage.getItem('streamliner-local-motion');if(saved==='off'||saved==='on')manualMotion=saved==='on';}catch{}
  const engine=new window.StreamlinerEngine();
  const parts=engine.getState().parts;
  const byId=Object.fromEntries(parts.map(p=>[p.id,p]));
  const sockets=[...document.querySelectorAll('.socket')];
  const scene=$('journey-scene'),rig=$('rig'),dialog=$('logbook-dialog');
  const announce=text=>{$('action-announcement').textContent=text;};
  const focusBench=()=>{document.querySelector('.bench').scrollIntoView({behavior:motion?'smooth':'auto',block:'center'});$('test-charm').focus({preventScroll:true});};
  function syncLivingActivity(){living?.activity({busy:busy||salvageBusy||dialog.open,editing:dragging||document.activeElement?.id==='energy'});}
  function setBusy(value){busy=value;document.body.dataset.busy=String(value);render(state);syncLivingActivity();}
  function applyMotion(){
    motion=!reduced.matches&&manualMotion!==false;
    document.body.dataset.motion=motion?'on':'off';
    $('motion-toggle').textContent=motion?'Motion on':reduced.matches?'Motion reduced':'Motion off';
    $('motion-toggle').setAttribute('aria-pressed',String(motion));
    $('motion-toggle').setAttribute('aria-label',reduced.matches?'Motion follows your reduced-motion preference':`${motion?'Turn off':'Turn on'} ambient motion`);
    crew?.setMotion(motion);
    transit?.setMotion(motion);
    living?.setMotion(motion);
    if(!motion)scene.classList.remove('window-clearing');
  }
  function note(frequency,time=.25,delay=0,type='sine',volume=.025){
    if(!soundEnabled||!audioContext||audioContext.state!=='running')return;
    const start=audioContext.currentTime+delay,osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+time);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(start);osc.stop(start+time+.03);
  }
  function soundCue(kind){
    if(kind==='fit'){note(340,.09,0,'triangle',.015);note(510,.12,.07,'sine',.012);}
    if(kind==='test'){note(165,.2,0,'triangle',.01);note(247,.2,.22,'triangle',.012);note(330,.35,.45,'sine',.018);}
    if(kind==='success'){[392,523.25,659.25].forEach((n,i)=>note(n,.65,i*.16,'sine',.022));}
    if(kind==='phase'){note(110,1.7,0,'sine',.01);note(164.8,1.4,.3,'sine',.008);}
  }
  function phaseSound(kind){
    if(!soundEnabled||!audioContext||audioContext.state!=='running'||document.hidden)return;
    if(kind==='charge'){
      note(220,.9,0,'sine',.022);note(329.63,1.2,.16,'sine',.015);
      const voice=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
      voice.type='sine';voice.frequency.setValueAtTime(73.4,now);voice.frequency.exponentialRampToValueAtTime(146.8,now+2.1);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.022,now+.8);gain.gain.exponentialRampToValueAtTime(.0001,now+3.1);
      voice.connect(gain);gain.connect(audioContext.destination);phaseVoices.add(voice);voice.onended=()=>{phaseVoices.delete(voice);voice.disconnect();gain.disconnect();};voice.start(now);voice.stop(now+3.2);
    }else if(kind==='cross'){note(98,1.1,0,'triangle',.014);note(587.33,.8,.03,'sine',.014);}
    else if(kind==='resolve'){note(440,.9,0,'sine',.015);note(659.25,1.1,.13,'sine',.012);}
    else if(kind==='depart')note(174.61,1.3,0,'sine',.013);
    else if(kind==='arrive'){note(329.63,.6,0,'sine',.012);note(261.63,.9,.25,'sine',.01);}
  }
  async function setSound(enabled){
    const request=++soundRequest;
    if(enabled){
      try{
        if(!audioContext){
          const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Sound unavailable');
          audioContext=new Audio();humGain=audioContext.createGain();humGain.gain.value=0;humGain.connect(audioContext.destination);
          for(const [frequency,level] of [[73.4,.006],[110,.004],[146.8,.002]]){
            const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.value=frequency;gain.gain.value=level;oscillator.connect(gain);gain.connect(humGain);oscillator.start();humOscillators.push(oscillator);
          }
          const wobble=audioContext.createOscillator();motorWobble=audioContext.createGain();wobble.frequency.value=1.7;motorWobble.gain.value=scene.classList.contains('fault-lighting') ? .09 : .006;wobble.connect(motorWobble);motorWobble.connect(humGain.gain);wobble.start();humOscillators.push(wobble);
        }
        await audioContext.resume();if(request!==soundRequest||destroyed||document.hidden)return;
        humGain.gain.setTargetAtTime(.3+transitSpeed*.5,audioContext.currentTime,.5);soundEnabled=true;soundCue('fit');
      }catch{if(request!==soundRequest||destroyed)return;soundEnabled=false;announce('Sound is unavailable in this browser. You can still work with the crew.');}
    }else{
      soundEnabled=false;
      for(const voice of phaseVoices){try{voice.stop();}catch{}}phaseVoices.clear();
      if(audioContext&&humGain){humGain.gain.cancelScheduledValues(audioContext.currentTime);humGain.gain.setValueAtTime(0,audioContext.currentTime);await audioContext.suspend().catch(()=>{});}
    }
    if(request!==soundRequest||destroyed)return;
    $('sound-toggle').textContent=soundEnabled?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
  }
  $('sound-toggle').addEventListener('click',()=>setSound(!soundEnabled));
  $('motion-toggle').addEventListener('click',()=>{manualMotion=!motion;try{localStorage.setItem('streamliner-local-motion',manualMotion?'on':'off');}catch{}applyMotion();});
  reduced.addEventListener('change',applyMotion);
  function resolveArt(src){return window.StreamlinerEmbeddedAssets?.[src.split('/').pop()]||src;}
  function alignHatch(){
    const art=scene.querySelector('.bay-art'),duct=scene.querySelector('.access-duct'),door=duct.querySelector('i');
    const frame=scene.getBoundingClientRect(),image=art.getBoundingClientRect();
    if(!frame.width||!frame.height)return;
    // Track the rendered source art, including its enlarged, offset mobile crop.
    hatchGeometry={x:(image.left-frame.left+HATCH.x/HATCH.artWidth*image.width)/frame.width,y:(image.top-frame.top+HATCH.y/HATCH.artHeight*image.height)/frame.height,width:HATCH.width/HATCH.artWidth*image.width/frame.width,height:HATCH.height/HATCH.artHeight*image.height/frame.height};
    for(const [key,value] of Object.entries({left:hatchGeometry.x,top:hatchGeometry.y,width:hatchGeometry.width,height:hatchGeometry.height}))duct.style[key]=`${value*100}%`;
    // The open grille is the actual painted grille, sampled through CSS texture coordinates.
    // Closed, this element is invisible and leaves the original plate untouched.
    door.style.backgroundImage=`url("${art.currentSrc||art.src}")`;
    door.style.backgroundSize=`${HATCH.artWidth/HATCH.width*100}% ${HATCH.artHeight/HATCH.height*100}%`;
    door.style.backgroundPosition=`${HATCH.x/(HATCH.artWidth-HATCH.width)*100}% ${HATCH.y/(HATCH.artHeight-HATCH.height)*100}%`;
  }
  function prepareHatch(){
    alignHatch();scene.querySelector('.bay-art').addEventListener('load',alignHatch);
    if(window.ResizeObserver){fixtureObserver=new ResizeObserver(alignHatch);fixtureObserver.observe(scene);fixtureObserver.observe(scene.querySelector('.bay-art'));}
    else window.addEventListener('resize',alignHatch);
  }
  function finishWindowClear(event){if(event.animationName==='glassMistClearing')scene.classList.remove('window-clearing');}
  async function prepareTransit(){
    const raw=JSON.parse($('phase-environments').textContent);
    const environments=raw.map(env=>({...env,route:env.title}));
    const preloadResults=await Promise.all(environments.map(env=>new Promise(resolve=>{
      const preload=new Image();preload.onload=()=>resolve(true);preload.onerror=()=>resolve(false);preload.src=resolveArt(env.src);
    })));
    if(destroyed)return;
    const views=environments.filter((env,index)=>preloadResults[index]);
    if(!views.length){$('watch-crossing').disabled=true;$('transit-state').textContent='NAVIGATION CHARM RESTING';return;}
    const layers=[$('view-a'),$('view-b')],reflections=[$('floor-a'),$('floor-b')],origins=[0,0];
    transit=window.StreamlinerTransit.create({
      scene,layerA:layers[0],layerB:layers[1],statusNode:$('transit-state'),speedNode:$('transit-speed'),routeNode:$('journey-route'),captionNode:$('journey-caption'),button:$('watch-crossing'),environments:views,motion,maxDistanceBetweenCrossings:70,durations:{cruising:16000,betweenCrossings:18000},
      onEnvironment(index,layerIndex,snapshot){
        const view=views[index];origins[layerIndex]=snapshot.distance;
        layers[layerIndex].style.backgroundImage=`url("${resolveArt(view.src)}")`;
        reflections[layerIndex].style.backgroundImage=layers[layerIndex].style.backgroundImage;
        reflections.forEach((reflection,i)=>reflection.classList.toggle('is-active',i===layerIndex));
        layers[layerIndex].style.transform='translate3d(-7%,0,0)';
        layers[layerIndex].dataset.kind=view.kind;
        $('view-title').textContent=view.title;
        scene.style.setProperty('--phase-color',view.palette[0]);scene.style.setProperty('--phase-second',view.palette[1]);
      },
      onSpeed(speed,distance,snapshot){
        transitSpeed=speed;scene.style.setProperty('--travel-speed',speed.toFixed(3));
        const surge=Math.max(0,speed-.9);scene.style.setProperty('--travel-blur',`${(surge*5.2).toFixed(2)}px`);
        scene.style.setProperty('--streak-opacity',Math.min(.45,Math.max(0,speed-.35)*.32).toFixed(3));
        for(let i=0;i<layers.length;i++){
          const relative=Math.max(0,distance-origins[i]);
          // All panning follows integrated speed. Frames never change their CSS duration.
          layers[i].style.transform=`translate3d(-${(7+Math.min(80,relative)*.28).toFixed(3)}%,0,0) scaleX(${(1+surge*.065).toFixed(3)})`;
          reflections[i].style.transform=`translate3d(-${(Math.min(80,relative)*.1).toFixed(3)}%,0,0) scaleY(-1)`;
        }
        $('pace-fill').style.width=`${Math.min(100,speed/1.6*100).toFixed(1)}%`;
        $('transit-speed').textContent=!snapshot.motion?'At ease':speed<.015?'Stationary':snapshot.stage==='arriving'?'Slowing down':speed>1.08?'Phase surge':snapshot.stage==='departing'?'Pulling away':'Cruising';
        if(soundEnabled&&audioContext?.state==='running'){
          humGain.gain.setTargetAtTime(.3+speed*.5,audioContext.currentTime,.4);
          humOscillators.slice(0,3).forEach((oscillator,index)=>oscillator.frequency.setTargetAtTime([73.4,110,146.8][index]*(1+speed*.11),audioContext.currentTime,.5));
        }
      },
      onStage(stage,snapshot){
        const view=views[snapshot.envIndex];
        $('hold-journey').setAttribute('aria-pressed',String(snapshot.held));
        $('hold-journey').innerHTML=snapshot.held?'Resume journey <span aria-hidden="true">▷</span>':'Linger here <span aria-hidden="true">Ⅱ</span>';
        const crossing=['charging','phasing','resolving'].includes(stage);
        const label={charging:'Wards gathering…',phasing:'Passing through…',resolving:'Crossing clear…'}[stage];
        $('watch-crossing').innerHTML=`${crossing?label:stage==='stopped'&&snapshot.motion?'Depart & phase':'Phase to the next stop'} <span aria-hidden="true">↗</span>`;
        $('crossing-marker').textContent={stopped:'SPATIAL WARDS / STANDING BY',departing:'SPATIAL WARDS / ONLINE',cruising:'THE DIRECT ROUTE / THROUGH ANYTHING',charging:'MATTER BOUNDARY / APPROACHING',phasing:'SOLID MATTER / PASSING THROUGH',resolving:'PHASE COMPLETE / WARDS HOLDING',arriving:'NEXT PLATFORM / APPROACHING'}[stage];
        if(stage==='cruising')$('journey-caption').textContent=view.caption;
        if(stage==='stopped'&&view.kind==='station')$('journey-caption').textContent='Not a ripple in the glass. A little work before departure.';
        if(stage==='arriving'&&view.kind!=='station'){
          $('transit-state').textContent='TAKING IN THE VIEW';$('journey-caption').textContent='The carriage slows. Let this corner of the world stay a little longer.';$('crossing-marker').textContent='THE VIEW / SETTLING';
        }
        if(stage==='departing'&&view.kind!=='station'){
          $('transit-state').textContent='ON OUR WAY';$('journey-caption').textContent='The world begins to slip past again. The wards know the way.';
        }
        if(!snapshot.motion){$('transit-state').textContent='CARRIAGE AT EASE';$('journey-caption').textContent=`${view.title}. The next crossing can wait.`;}
        if(!busy){$('blue-duty').textContent=crossing?'Watching the spatial control matrix':'Keeping an eye on the wards';$('blue-caption').textContent=crossing?'All quite solid. For now.':'Wards holding. Probably.';}
      },
      onCue:phaseSound
    });
    $('hold-journey').addEventListener('click',()=>transit.hold(!transit.getState().held));
    transit.start();
  }
  function crewStatus(event){
    if(destroyed)return;
    if(event.task==='retrieve'){
      const part=byId[event.partId],name=part?.name||'something useful';
      const lines={departing:'Off through the service passage',searching:'Searching the little spaces',returning:`Bringing back a ${name}`,arrived:'Sorting the salvage',complete:'Back at the salvage drawer'};
      $('orange-duty').textContent=lines[event.phase]||'Salvage & retrieval';
      if(event.phase==='departing')$('crew-status').textContent='Orange has gone to see what the train has been keeping.';
      if(event.phase==='searching')$('crew-status').textContent='A small clatter from somewhere beyond the carriage. Orange, presumably.';
      if(event.phase==='returning')$('crew-status').textContent=`Orange returns with a ${name}. It was probably not being used.`;
    }
    if(event.task==='install'){
      scene.dataset.crewPhase=event.phase;
      scene.classList.toggle('duct-open',['reaching','climbing','fitting'].includes(event.phase));
      scene.classList.toggle('fitting',event.phase==='fitting'||event.phase==='climbing');
      const lines={carrying:'Carrying your circuit',reaching:'Opening the access duct',climbing:'In the small spaces',fitting:'Fitting the charm',complete:'Checking the fittings'};
      $('shades-duty').textContent=lines[event.phase]||'Ducts, fittings & small spaces';
      if(event.phase==='climbing'){$('crew-status').textContent='Shades disappears into the duct with your circuit. A tiny voice: “This one?”';$('blue-caption').textContent='Still watching the wards.';}
      if(event.phase==='fitting'){$('crew-status').textContent=scene.dataset.installKind==='lighting'?'The lamps go out. The wards do not. A muffled: “Ah. That one.”':'A turn of something small. A thump. An extremely confident silence.';note(130,.45,0,'triangle',.008);}
    }
  }
  function retrieveSalvage(partId,event){
    if(destroyed||busy||salvageBusy||!crew)return false;
    const bounds=scene.getBoundingClientRect();
    if(event.source==='ambient'&&(bounds.bottom<=0||bounds.top>=innerHeight))return false;
    salvageBusy=true;syncLivingActivity();$('request-salvage').disabled=true;
    $('salvage-status').textContent='Orange is out checking the service passages.';
    crew.retrieve(partId,result=>{
      if(destroyed)return;salvageBusy=false;syncLivingActivity();$('request-salvage').disabled=busy;
      if(result.cancelled){$('orange-duty').textContent='Salvage & retrieval';return;}
      const name=byId[partId].name;
      for(const button of document.querySelectorAll('.part'))button.classList.toggle('fresh-salvage',button.dataset.part===partId);
      $('salvage-status').textContent=`Just returned: ${name}. Checked and ready.`;
      $('orange-duty').textContent='Back with something useful';$('crew-status').textContent=`Orange leaves a ${name} in the drawer. The rest of the salvage is still yours to use.`;
      soundCue('fit');announce(`Orange returned with a ${name}. It is in the salvage drawer.`);
    },{onStatus:crewStatus});
    return true;
  }
  function livingEvent(event){
    if(destroyed)return;
    if(event.type==='job-notice'){
      $('dispatch-note').hidden=false;$('dispatch-note').textContent='A fresh maintenance slip is on its way. The repaired fittings are holding.';
      $('crew-status').textContent='A folded note from the conductor arrives at the hatch.';
    }
    if(event.type==='job-arrived'){
      $('dispatch-note').hidden=false;$('dispatch-note').textContent='JUST PINNED UP · A note from the conductor';
      $('crew-status').textContent=`Shades pins up the next slip: ${state.activeJob.title.toLowerCase()}. No rush.`;
      $('installation-toast').hidden=true;$('readout-checks').replaceChildren();
      announce(`A new maintenance slip: ${state.activeJob.title}.`);note(293.66,.5,0,'sine',.009);
    }
    if(event.type==='progress-reset'){$('dispatch-note').hidden=true;}
    if(event.type==='vignette'&&!busy&&!salvageBusy)$('crew-status').textContent=event.item;
  }
  $('request-salvage').addEventListener('click',()=>{
    if(!living||busy||salvageBusy)return;
    scene.scrollIntoView({behavior:'instant',block:'center'});
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!destroyed&&!living.requestSalvage()){$('crew-status').textContent='Orange is still sorting the last find. Give those little hands a moment.';announce('Orange is still sorting the last find.');}}));
  });
  document.addEventListener('focusin',syncLivingActivity);
  document.addEventListener('focusout',()=>queueMicrotask(syncLivingActivity));
  for(const detail of document.querySelectorAll('.carriage-find'))detail.addEventListener('toggle',()=>living?.activity());
  function choosePart(slot,id){if(busy)return;living?.activity();engine.selectPart(slot,id);soundCue('fit');const part=byId[id];announce(part?`${part.name} fitted in the ${labels[slot].toLowerCase()} socket.`:`${labels[slot]} socket cleared.`);}
  for(const part of parts){
    const button=document.createElement('button');button.type='button';button.className='part';button.draggable=true;button.dataset.part=part.id;button.dataset.slot=part.slot;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`Fit ${part.name} in the ${labels[part.slot].toLowerCase()} socket. ${part.description}`);button.title=part.description;
    button.innerHTML=`${icon(part.icon)}<small>${concise[part.id]}</small><strong>${part.name}</strong>`;
    button.addEventListener('click',()=>choosePart(part.slot,part.id));
    button.addEventListener('dragstart',event=>{if(busy){event.preventDefault();return;}dragging=true;syncLivingActivity();event.dataTransfer.setData('text/plain',part.id);event.dataTransfer.effectAllowed='copy';button.classList.add('dragging');});
    button.addEventListener('dragend',()=>{dragging=false;syncLivingActivity();button.classList.remove('dragging');sockets.forEach(n=>n.classList.remove('drag-over'));});
    $('parts-drawer').append(button);
  }
  for(const socket of sockets){
    const slot=socket.dataset.slot;
    socket.addEventListener('click',()=>{
      if(busy)return;
      if(state.build[slot])choosePart(slot,null);
      else document.querySelector(`.part[data-slot="${slot}"]`).focus();
    });
    socket.addEventListener('dragover',event=>{if(!busy){event.preventDefault();event.dataTransfer.dropEffect='copy';socket.classList.add('drag-over');}});
    socket.addEventListener('dragleave',()=>socket.classList.remove('drag-over'));
    socket.addEventListener('drop',event=>{event.preventDefault();socket.classList.remove('drag-over');if(busy)return;const part=byId[event.dataTransfer.getData('text/plain')];if(!part)return;if(part.slot!==slot){announce(`${part.name} belongs in the ${labels[part.slot].toLowerCase()} socket.`);return;}choosePart(slot,part.id);});
  }
  $('energy').addEventListener('input',event=>{if(!busy)engine.setPower(event.target.value);});
  $('clear-build').addEventListener('click',()=>{if(!busy){engine.resetBuild();announce('The sockets are clear. Your diagrams are still in the logbook.');}});
  $('test-charm').addEventListener('click',()=>{
    if(busy)return;
    if(!Object.values(state.build).every(Boolean)){engine.evaluate();document.querySelector(`.part[data-slot="${Object.keys(state.build).find(k=>!state.build[k])}"]`)?.focus();return;}
    setBusy(true);rig.classList.add('is-testing');$('bench-notice').textContent='A little hum. A little anticipation…';$('test-charm').textContent='Testing the circuit…';soundCue('test');
    clearTimeout(busyTimer);busyTimer=setTimeout(()=>{
      if(destroyed)return;busy=false;rig.classList.remove('is-testing');engine.evaluate();syncLivingActivity();
      announce(state.result.successful?(state.activeJob.completed?'Bench test passed. Your signed-off repair is already in the logbook.':'Bench test passed. Shades can install this charm.'):state.result.diagnostic);
    },motion?1050:100);
  });
  $('install-charm').addEventListener('click',()=>{
    if(busy||!state.result?.successful||state.activeJob.completed)return;
    const kind=state.activeJob.kind;
    setBusy(true);scene.classList.add('installing');scene.dataset.installKind=kind;$('crew-status').textContent='Shades is taking your circuit to the access duct.';
    $('bench-notice').textContent='Mind the little feet. Shades is on the way.';announce('Shades is carrying your charm to the service hatch.');
    const done=(result)=>{
      if(destroyed)return;busy=false;scene.classList.remove('fitting','duct-open','installing');delete scene.dataset.crewPhase;
      if(result?.cancelled){render(state);syncLivingActivity();return;}
      engine.completeRepair();syncLivingActivity();soundCue('success');$('shades-duty').textContent='Fitting checked. Small hands, steady work.';
      if(kind==='window'&&motion)scene.classList.add('window-clearing');
      scene.classList.add(`${kind==='lighting'?'lighting':kind==='window'?'window':'chime'}-repaired`);
      const titles={lighting:'A little light, restored.',window:'There you are, London.',announcement:'One clear note. Next stop?'};
      const notes={lighting:'The reading lights settle. Someone turns another page.',window:'The mist lifts from the glass. The city comes back into view.',announcement:'The next-stop chime finds its voice. The conductor approves.'};
      $('installation-title').textContent=titles[kind];$('installation-note').textContent=notes[kind];$('installation-toast').hidden=false;
      $('journey-caption').textContent=notes[kind];$('crew-status').textContent='Your circuit is part of the carriage now. Good work, crew.';
      clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('installation-toast').hidden=true;},6500);
      scene.scrollIntoView({behavior:motion?'smooth':'auto',block:'center'});announce(`${titles[kind]} Repair saved in your logbook.`);
    };
    scene.scrollIntoView({behavior:'instant',block:'center'});
    if(crew)requestAnimationFrame(()=>requestAnimationFrame(()=>crew.install(done,{getHatchRect:()=>hatchGeometry,onStatus:crewStatus})));else busyTimer=setTimeout(done,200);
  });
  $('next-job').addEventListener('click',()=>{
    if(busy)return;
    $('installation-toast').hidden=true;clearTimeout(toastTimer);if(living?!living.takeNextJob():!engine.nextJob())return;$('readout-checks').replaceChildren();
    $('journey-caption').textContent='A new slip from the conductor. No need to rush.';$('crew-status').textContent='Shades has already found something else that needs a hand.';
    focusBench();announce(`${state.activeJob.title}. A fresh job is on the board.`);
  });
  function render(snapshot){
    if(!snapshot)return;state=snapshot;document.body.dataset.busy=String(busy);
    const job=state.activeJob,count=Object.values(state.build).filter(Boolean).length;
    if(scene.dataset.repairJob!==job.id){scene.classList.remove('window-clearing');scene.dataset.repairJob=job.id;}
    const number=String(state.logbook.shift).padStart(2,'0');
    $('shift-number').textContent=`SHIFT ${number}`;$('ticket-number').textContent=String(state.logbook.shift).padStart(3,'0');
    $('job-index').textContent=`JOB ${number} / ${indexTitles[job.kind]}`;
    $('job-category').textContent=categories[job.kind];$('job-title').textContent=job.title;$('job-brief').textContent=job.brief;$('job-hint').textContent=job.hint;
    const needs=$('job-needs');needs.replaceChildren();
    for(const [key,target] of Object.entries(job.target)){
      const row=document.createElement('div');row.className='need-row';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=stats[key];value.textContent=target.min!==undefined&&target.max!==undefined?`${target.min}–${target.max}`:target.min!==undefined?`${target.min} or more`:`${target.max} or less`;row.append(label,value);needs.append(row);
    }
    for(const socket of sockets){
      const slot=socket.dataset.slot,part=byId[state.build[slot]],art=socket.querySelector('.socket-art');
      socket.classList.toggle('filled',Boolean(part));socket.disabled=busy;
      const nextKey=part?.id||'empty';if(art.dataset.part!==nextKey){art.innerHTML=part?icon(part.icon):'+';art.dataset.part=nextKey;}
      socket.querySelector('.socket-name').textContent=part?part.name:{power:'Give it a heartbeat',control:'Give it some manners',output:'Give it a purpose'}[slot];
      socket.querySelector('.socket-action').textContent=part?'Tap to lift it out':`Choose ${slot==='output'?'an':'a'} ${labels[slot].toLowerCase()} below`;
      socket.setAttribute('aria-label',part?`${labels[slot]} socket: ${part.name}. Activate to remove.`:`${labels[slot]} socket, empty. Activate to choose a part.`);
    }
    for(const button of document.querySelectorAll('.part')){button.setAttribute('aria-pressed',String(state.build[button.dataset.slot]===button.dataset.part));button.disabled=busy;button.draggable=!busy;}
    $('energy').value=state.setting;$('energy').disabled=busy;$('energy-value').textContent=state.setting;
    $('clear-build').disabled=busy;$('test-charm').disabled=busy;
    if(!busy)$('test-charm').innerHTML=`${job.completed?'Test another idea':'Test the charm'} <span aria-hidden="true">↗</span>`;
    $('install-charm').hidden=job.completed;$('install-charm').disabled=busy||!state.result?.successful;
    $('next-job').hidden=!job.completed;$('next-job').disabled=busy;$('ticket-stamp').hidden=!job.completed;
    $('assembly-status').textContent=job.completed?'SIGNED OFF':`${count} / 3 parts fitted`;
    $('logbook-count').textContent=String(state.logbook.completedJobs.length).padStart(2,'0');
    if(!busy)$('bench-notice').textContent=state.notice;
    $('sprite-line').textContent=state.result?.spriteLine?`“${state.result.spriteLine}”`:state.logbook.completedJobs.length?'“Kept your tools where you left them. Shall we?”':'“Big hands. Small spaces. You’ll do nicely.”';
    const result=state.result;$('bench-readout').hidden=!result?.complete;
    rig.classList.toggle('is-powered',Boolean(result?.complete&&result.power>0));rig.dataset.output=state.build.output||'';
    if(result?.complete){
      $('bench-readout').classList.toggle('passed',result.successful);$('readout-kicker').textContent=result.successful?'BENCH TEST PASSED':'EVERY CIRCUIT TELLS YOU SOMETHING';
      $('readout-title').textContent=result.successful?(job.completed?'Targets met. Repair signed off.':'Ready for Shades to fit.'):'A little adjustment, perhaps.';
      $('readout-description').textContent=result.diagnostic;$('readout-behavior').textContent=result.behavior||'';
      const checks=$('readout-checks');checks.replaceChildren();
      for(const check of result.checks){
        const row=document.createElement('div');row.className=`check ${check.pass?'pass':''}`;
        const top=document.createElement('div');top.className='check-top';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=check.label;value.textContent=check.value;top.append(label,value);
        const meter=document.createElement('div');meter.className='check-meter';const fill=document.createElement('i');fill.style.width=`${check.value}%`;meter.append(fill);
        const target=document.createElement('small');target.textContent=`${check.pass?'✓':'○'} ${check.target}`;row.append(top,meter,target);checks.append(row);
      }
    }
    for(const [kind,cls] of [['lighting','lighting-repaired'],['window','window-repaired'],['announcement','chime-repaired']]){
      const fault=job.kind===kind&&!job.completed;
      const done=!fault&&state.logbook.completedJobs.some(item=>item.kind===kind);
      scene.classList.toggle(cls,done);
      scene.classList.toggle(`fault-${kind}`,fault);
    }
    if(motorWobble&&audioContext?.state==='running')motorWobble.gain.setTargetAtTime(scene.classList.contains('fault-lighting') ? .09 : .006,audioContext.currentTime,.8);
    $('request-salvage').disabled=busy||salvageBusy;
    if(dialog.open)renderLogbook();
  }
  function renderLogbook(){
    const progress=state.logbook,entries=$('logbook-entries');entries.replaceChildren();
    $('logbook-summary').textContent=`Carriage repairs and circuit diagrams, kept for your next visit.`;
    $('save-status').textContent=state.storageStatus==='available'?'Saved on this device. The crew will remember your work.':'Your work is kept for this visit. This browser cannot save it between visits.';
    if(!progress.discoveries.length){const empty=document.createElement('p');empty.className='book-empty';empty.textContent='Nothing in the book yet. Every complete bench test leaves a little discovery here.';entries.append(empty);return;}
    if(progress.bestRepairs.length){
      const title=document.createElement('p');title.className='book-section-title';title.textContent='SIGNED OFF / WORKING CIRCUITS';entries.append(title);
      for(const repair of progress.bestRepairs){entries.append(bookEntry(repair.title,`${repair.combinationName} · ${repair.setting} energy · ${repair.route}`,repair.parts,repair.setting));}
    }
    const title=document.createElement('p');title.className='book-section-title';title.textContent='DIAGRAMS FROM THE WORKBENCH';entries.append(title);
    for(const discovery of [...progress.discoveries].reverse())entries.append(bookEntry(discovery.name,`First tested on shift ${String(discovery.firstShift).padStart(2,'0')} · last energy ${discovery.lastSetting}`,discovery.parts,discovery.lastSetting));
  }
  function bookEntry(title,text,build,setting){
    const row=document.createElement('div');row.className='book-entry';const copy=document.createElement('div'),name=document.createElement('strong'),description=document.createElement('p'),button=document.createElement('button');name.textContent=title;description.textContent=text;copy.append(name,description);button.textContent='Rebuild';button.disabled=busy;
    button.addEventListener('click',()=>{if(busy)return;for(const slot of Object.keys(build))engine.selectPart(slot,build[slot]);engine.setPower(setting);dialog.close();focusBench();soundCue('fit');announce('Your saved circuit is on the bench. Test it for this repair.');});row.append(copy,button);return row;
  }
  function openLogbook(){renderLogbook();$('reset-confirmation').hidden=true;dialog.showModal();syncLivingActivity();}
  $('open-logbook').addEventListener('click',openLogbook);$('open-logbook-bottom').addEventListener('click',openLogbook);$('close-logbook').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close',syncLivingActivity);
  $('reset-progress').addEventListener('click',()=>{if(!busy){$('reset-confirmation').hidden=false;$('cancel-reset').focus();}});
  $('cancel-reset').addEventListener('click',()=>{$('reset-confirmation').hidden=true;$('reset-progress').focus();});
  $('confirm-reset').addEventListener('click',()=>{if(busy)return;engine.resetProgress();$('reset-confirmation').hidden=true;$('installation-toast').hidden=true;announce('A fresh logbook. Welcome back to the first carriage.');});
  prepareHatch();
  scene.querySelector('.window-mist').addEventListener('animationend',finishWindowClear);
  crew=window.StreamlinerCrew?.create({canvas:$('crew-runway'),shadesPortrait:$('shades-portrait'),getHatchRect:()=>hatchGeometry,onStatus:crewStatus});
  const bayPlate=new Image();bayPlate.onload=()=>{
    const canvas=$('bay-portrait'),context=canvas.getContext('2d');if(!context)return;
    context.imageSmoothingQuality='high';context.clearRect(0,0,canvas.width,canvas.height);
    const source={x:1179,y:59,w:383,h:889},scale=Math.min(canvas.width/source.w,canvas.height/source.h),w=source.w*scale,h=source.h*scale;
    context.drawImage(bayPlate,source.x,source.y,source.w,source.h,(canvas.width-w)/2,canvas.height-h,w,h);
  };bayPlate.src='assets/road-sprite-crew-plate.png';
  applyMotion();engine.subscribe(render);
  living=window.StreamlinerLiving.create({engine,scene:document.querySelector('main'),motion,canAdvance:snapshot=>snapshot.activeJob.completed,onRequestSalvage:retrieveSalvage,onEvent:livingEvent,vignettes:[
    'A small note on the gauge: “Wards checked. Ready for the next crossing.”',
    'Orange has sorted the screws by size. The teaspoon appears to be a separate category.',
    'The noise charms soften a passing conversation from the passenger carriage.',
    'Braking charge recovered. Blue watches it settle back into the instruments.',
    'Shades checks the hatch catch, then checks whether anyone saw how easy that was.'
  ]});living.start();
  prepareTransit().catch(()=>{$('transit-state').textContent='NAVIGATION CHARM RESTING';$('watch-crossing').disabled=true;});
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('is-away',document.hidden);if(document.hidden)setSound(false);});
  window.addEventListener('pagehide',()=>{destroyed=true;clearTimeout(busyTimer);clearTimeout(toastTimer);fixtureObserver?.disconnect();window.removeEventListener('resize',alignHatch);scene.querySelector('.bay-art').removeEventListener('load',alignHatch);scene.querySelector('.window-mist').removeEventListener('animationend',finishWindowClear);living?.destroy();crew?.destroy();transit?.destroy();setSound(false);});
  // A history-restored page must recreate timers/canvas rather than keep a destroyed controller.
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  // The test remains a classic-script page, so its assets also work from file://.
})();

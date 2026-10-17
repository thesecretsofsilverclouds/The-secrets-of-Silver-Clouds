/* Local crew portraits and approved run strips. No application state or network writes.
 * retrieve(partId, callback, {side, homeRatio, onStatus}) sends Orange for a part.
 * install(callback, {destinationRatio, getHatchRect, onStatus}) sends Shades into the access duct.
 * create/getHatchRect returns live normalized scene bounds {x,y,width,height} for that opening.
 * New-task callbacks receive {id, task, crew, partId, completed, cancelled}.
 * Tasks serialize; hidden/offscreen new tasks pause. Legacy deliver keeps its callback signature.
 */
(function (global) {
  'use strict';
  const source = document.currentScript && document.currentScript.src;
  const assets = new URL('assets/',source || document.baseURI);
  const FRAME_WIDTH=192,FRAME_HEIGHT=224,FPS=24;
  const CREW={shades:{frames:16,crop:[21,48,404,949]},orange:{frames:22,crop:[798,66,1172,949]}};
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const ratio=(value,fallback)=>Number.isFinite(value)?clamp(value):fallback;
  const validCrew=value=>Object.hasOwn(CREW,value)?value:'orange';

  function create({canvas,shadesPortrait,orangePortrait,onDelivery,onStatus,getHatchRect,destinationRatio=.77}={}) {
    const context=canvas&&canvas.getContext('2d');
    const reduced=global.matchMedia('(prefers-reduced-motion: reduce)');
    const portraits={shades:shadesPortrait,orange:orangePortrait};
    const destination=ratio(destinationRatio,.77),images={},queue=[];
    let dead=false,motion=true,inView=true,width=0,height=0;
    let raf=0,ambientTimer=0,phaseTimer=0,arrivalTimer=0;
    let ambient=null,active=null,arrival=null,ambientIndex=0,excursionIndex=0,taskId=0,lastPaint=-Infinity;
    const now=()=>global.performance.now();
    const visible=()=>!dead&&!document.hidden&&inView;
    const animated=()=>motion&&!reduced.matches;
    const moving=()=>visible()&&animated();

    function load(name,filename) {
      const image=new Image(),entry=images[name]={image,ready:false};
      image.decoding='async';
      image.onload=()=>{
        if(dead)return;
        entry.ready=!!image.naturalWidth;
        if(name==='plate')drawPortraits();
        else{paint(now());if(!active&&!ambient&&!arrival)scheduleAmbient();}
      };
      image.onerror=()=>{entry.ready=false;};
      image.src=new URL(filename,assets).href;
    }
    function fit(target) {
      if(!target)return null;
      const bounds=target.getBoundingClientRect();
      const w=bounds.width||target.clientWidth||Number(target.getAttribute('width'))||160;
      const h=bounds.height||target.clientHeight||Number(target.getAttribute('height'))||220;
      const dpr=Math.min(2,global.devicePixelRatio||1);
      const backingWidth=Math.max(1,Math.round(w*dpr)),backingHeight=Math.max(1,Math.round(h*dpr));
      if(target.width!==backingWidth)target.width=backingWidth;
      if(target.height!==backingHeight)target.height=backingHeight;
      const ctx=target.getContext('2d');
      if(!ctx)return null;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      return{ctx,width:w,height:h};
    }
    function drawPortraits() {
      if(dead||!images.plate?.ready)return;
      Object.keys(portraits).forEach(crew=>{
        const target=fit(portraits[crew]);if(!target)return;
        const{ctx,width:w,height:h}=target,[x1,y1,x2,y2]=CREW[crew].crop;
        const sw=x2-x1,sh=y2-y1,scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
        ctx.clearRect(0,0,w,h);
        ctx.drawImage(images.plate.image,x1,y1,sw,sh,(w-dw)/2,(h-dh)/2,dw,dh);
      });
    }
    function resize() {
      const target=fit(canvas);
      if(target){width=target.width;height=target.height;}
      drawPortraits();paint(now());
    }
    function clear(){if(context)context.clearRect(0,0,width,height);}
    function cancelFrame(){if(raf)global.cancelAnimationFrame(raf);raf=0;}
    function stopAmbient(){global.clearTimeout(ambientTimer);ambientTimer=0;ambient=null;}
    function spriteHeight(){return width<640?90:Math.min(125,Math.max(100,height*.22));}
    function elapsed(item,time=now()){return clamp(item.elapsed+(item.started===null?0:time-item.started),0,item.duration);}
    function taskProgress(item,time=now()){return clamp((item.index+elapsed(item,time)/item.duration)/item.phases.length);}
    function callLater(fn,...args){if(typeof fn==='function')global.setTimeout(()=>fn(...args),0);}
    function status(item,phase=item.phases[item.index]?.name,paused=item.paused) {
      const handler=typeof item.options.onStatus==='function'?item.options.onStatus:onStatus;
      if(typeof handler!=='function')return;
      const event={id:item.id,task:item.type,crew:item.crew,partId:item.partId||null,phase,
        progress:phase==='complete'?1:taskProgress(item),paused:!!paused};
      global.setTimeout(()=>{if(!dead||phase==='cancelled')handler(event);},0);
    }
    function notify(item,cancelled=false) {
      if(item.notified)return;
      item.notified=true;
      const result={id:item.id,task:item.type,crew:item.crew,partId:item.partId||null,completed:!cancelled,cancelled};
      if(item.type==='deliver'){callLater(item.callback,item.crew,result);callLater(onDelivery,item.crew,result);}
      else callLater(item.callback,result);
    }

    function drawPart(partId,size) {
      // Props are separate canvas shapes; the approved sprite pixels are untouched.
      const c=context,s=size;
      c.shadowColor='#7ae7ed';c.shadowBlur=8;c.lineWidth=1.25;c.strokeStyle='#efd18c';c.fillStyle='#65cbd8';
      if(partId==='pulse-cell'){
        c.fillRect(-s*.3,-s*.5,s*.6,s);c.strokeRect(-s*.3,-s*.5,s*.6,s);
        c.fillStyle='#f2d68b';c.fillRect(-s*.15,-s*.65,s*.3,s*.15);
        c.fillStyle='#e5fff6';c.fillRect(-s*.15,-s*.3,s*.3,s*.18);
      }else if(partId==='storm-capacitor'){
        c.fillStyle='#a391dd';c.fillRect(-s*.45,-s*.35,s*.9,s*.7);c.strokeRect(-s*.45,-s*.35,s*.9,s*.7);
        c.fillStyle='#f9e9a3';c.fillRect(-s*.08,-s*.45,s*.16,s*.9);
      }else if(partId==='prism-coil'){
        c.beginPath();c.arc(0,0,s*.42,0,Math.PI*2);c.stroke();
        c.beginPath();c.arc(0,0,s*.22,0,Math.PI*2);c.stroke();
        c.fillStyle='#a7eee8';c.fillRect(-s*.08,-s*.08,s*.16,s*.16);
      }else if(partId==='steady-regulator'){
        c.fillStyle='#476b80';c.fillRect(-s*.45,-s*.4,s*.9,s*.8);c.strokeRect(-s*.45,-s*.4,s*.9,s*.8);
        c.fillStyle='#94e4df';for(let i=0;i<3;i++)c.fillRect(-s*.27+i*s*.22,-s*.23,s*.1,s*.46);
      }else if(partId==='lumen-lens'){
        c.fillStyle='#d9f6e8';c.beginPath();c.arc(0,0,s*.42,0,Math.PI*2);c.fill();c.stroke();
        c.fillStyle='#fff6c5';c.fillRect(-s*.17,-s*.2,s*.18,s*.18);
      }else if(partId==='air-impeller'){
        for(let i=0;i<3;i++){c.save();c.rotate(i*Math.PI*2/3);c.fillRect(0,-s*.12,s*.52,s*.24);c.restore();}
        c.fillStyle='#f2d68b';c.beginPath();c.arc(0,0,s*.13,0,Math.PI*2);c.fill();
      }else{
        c.rotate(Math.PI/4);c.fillRect(-s/2,-s/2,s,s);c.strokeRect(-s/2,-s/2,s,s);
        c.shadowBlur=0;c.fillStyle='#d9f7ed';c.fillRect(-s*.24,-s*.24,s*.25,s*.25);
        c.fillStyle='#326b80';c.fillRect(s*.08,-s*.22,s*.14,s*.44);
      }
    }
    function hatchRect(item) {
      const read=typeof item.options.getHatchRect==='function'?item.options.getHatchRect:getHatchRect;
      if(typeof read!=='function')return null;
      let rect;
      try{rect=read();}catch{return null;}
      if(!rect||!['x','y','width','height'].every(key=>Number.isFinite(rect[key]))||rect.width<=0||rect.height<=0)return null;
      const left=clamp(rect.x),top=clamp(rect.y),right=clamp(rect.x+rect.width),bottom=clamp(rect.y+rect.height);
      if(right<=left||bottom<=top)return null;
      return{x:left*width,y:top*height,width:(right-left)*width,height:(bottom-top)*height};
    }
    function taskVisual(item,time,w,h) {
      const phase=item.phases[item.index].name,p=clamp(elapsed(item,time)/item.duration);
      const home=width*ratio(item.options.homeRatio,.20)-w/2;
      const opening=item.type==='install'?hatchRect(item):null;
      const hatch=opening?opening.x+opening.width/2-w/2:width*ratio(item.options.destinationRatio,destination)-w/2;
      const outside=item.side==='right'?width+w:-w*1.25;
      const base={crew:item.crew,x:hatch,y:height*.945-h,reverse:false,animate:false,alpha:1,scale:1,
        frameTime:elapsed(item,time),carried:null};
      if(!animated()){
        if(item.type==='retrieve')return phase==='searching'?null:{...base,x:home,
          reverse:item.side==='right',carried:phase==='returning'||phase==='arrived'?item.partId:null};
        return phase==='climbing'||phase==='fitting'?null:{...base,carried:'charm'};
      }
      if(item.type==='retrieve'){
        if(phase==='searching')return null;
        if(phase==='departing')return{...base,x:home+(outside-home)*p,reverse:item.side==='left',animate:true};
        if(phase==='returning')return{...base,x:outside+(home-outside)*p,reverse:item.side==='right',animate:true,carried:item.partId};
        return{...base,x:home,reverse:item.side==='right',carried:item.partId};
      }
      if(item.type==='deliver')return{...base,x:-w+(hatch+w)*p,animate:true,carried:'charm'};
      if(phase==='carrying'){
        const from=width*.12-w/2;
        return{...base,x:from+(hatch-from)*p,animate:true,carried:'charm'};
      }
      if(phase==='reaching')return{...base,carried:'charm',handY:.70-p*.06};
      if(phase==='climbing'){
        const smooth=p*p*(3-2*p);
        if(opening){
          // Keep full anatomy at the floor. The wall hides each part as it enters;
          // the last visible feet finish at the opening's center before a late depth fade.
          const endY=opening.y+opening.height/2-h*(218/FRAME_HEIGHT);
          const depth=clamp((p-.72)/.28),fade=depth*depth*(3-2*depth);
          return{...base,y:base.y+(endY-base.y)*smooth,alpha:1-fade,
            animate:true,stillFrame:true,carried:'charm',opening};
        }
        return{...base,x:hatch+w*.11*smooth,y:base.y-h*.62*smooth,scale:1-.22*smooth,
          alpha:1-smooth,animate:true,stillFrame:true,carried:'charm'};
      }
      return null; // Shades is inside the access duct during the fitting phase.
    }
    function currentVisual(time) {
      const h=spriteHeight(),w=h*FRAME_WIDTH/FRAME_HEIGHT;
      if(active)return taskVisual(active,time,w,h);
      if(arrival)return{crew:arrival.crew,x:width*arrival.destination-w/2,y:height*.945-h,
        reverse:false,animate:false,carried:'charm',alpha:1,scale:1,frameTime:0};
      if(!ambient)return null;
      const p=clamp((time-ambient.start)/ambient.duration);
      return{crew:ambient.crew,x:ambient.reverse?width+w-(width+w*2)*p:-w+(width+w*2)*p,
        y:height*.945-h,reverse:ambient.reverse,animate:true,alpha:1,scale:1,frameTime:time-ambient.start};
    }
    function paint(time) {
      clear();if(!context||!visible()||!width||!height)return;
      const visual=currentVisual(time);if(!visual||!images[visual.crew]?.ready)return;
      const h=spriteHeight(),w=h*FRAME_WIDTH/FRAME_HEIGHT;
      const frame=visual.animate&&!visual.stillFrame&&animated()?Math.floor(visual.frameTime*FPS/1000)%CREW[visual.crew].frames:0;
      context.save();context.globalAlpha=visual.alpha;
      if(visual.opening){
        const opening=visual.opening,bottom=opening.y+opening.height;
        context.beginPath();
        context.rect(opening.x,opening.y,opening.width,opening.height);
        context.rect(0,bottom,width,Math.max(0,height-bottom));
        context.clip();
      }
      context.translate(visual.x+(visual.reverse?w:0),visual.y);
      context.scale((visual.reverse?-1:1)*visual.scale,visual.scale);
      context.drawImage(images[visual.crew].image,frame*FRAME_WIDTH,0,FRAME_WIDTH,FRAME_HEIGHT,0,0,w,h);
      if(visual.carried){
        context.save();context.translate(w*.78,h*(visual.handY||.70));
        drawPart(visual.carried,Math.max(9,h*.105));context.restore();
      }
      context.restore();
    }
    function requestFrame() {
      if(raf||!moving())return;
      if(currentVisual(now())?.animate)raf=global.requestAnimationFrame(step);
    }
    function step(time) {
      raf=0;if(!moving())return;
      if(time-lastPaint>=1000/FPS-1){paint(time);lastPaint=time;}
      if(ambient&&time-ambient.start>=ambient.duration){ambient=null;clear();scheduleAmbient();return;}
      requestFrame();
    }
    function scheduleAmbient() {
      global.clearTimeout(ambientTimer);ambientTimer=0;
      if(!context||!moving()||active||queue.length||ambient||arrival)return;
      if(!images.shades?.ready&&!images.orange?.ready)return;
      ambientTimer=global.setTimeout(()=>{
        ambientTimer=0;if(!moving()||active||queue.length||ambient||arrival)return;
        const index=ambientIndex++;let crew=index%2?'orange':'shades';
        if(!images[crew]?.ready)crew=crew==='orange'?'shades':'orange';
        if(!images[crew]?.ready){scheduleAmbient();return;}
        ambient={crew,reverse:!!(index%2),start:now(),duration:5700};
        lastPaint=-Infinity;paint(now());requestFrame();
      },ambientIndex===0?1600:14000+Math.random()*10000);
    }

    function freezePhase() {
      if(!active)return;
      active.elapsed=elapsed(active);active.started=null;
      global.clearTimeout(phaseTimer);phaseTimer=0;cancelFrame();
    }
    function armPhase() {
      if(!active||dead)return;
      const item=active;global.clearTimeout(phaseTimer);phaseTimer=0;
      // Legacy deliver retains its original quick offscreen completion contract.
      const shortcut=item.type==='deliver'&&!visible();
      if(!visible()&&!shortcut){
        if(!item.paused){item.paused=true;status(item);}
        clear();return;
      }
      const wasPaused=item.paused;item.paused=false;
      const phase=item.phases[item.index];
      const duration=animated()&&!shortcut?phase.ms:(item.type==='deliver'?160:140);
      item.elapsed=item.duration?item.elapsed/item.duration*duration:0;
      item.duration=duration;item.started=now();
      if(wasPaused)status(item);
      const index=item.index;
      phaseTimer=global.setTimeout(()=>{
        phaseTimer=0;if(active!==item||item.index!==index||dead)return;advancePhase();
      },Math.max(0,duration-item.elapsed));
      paint(now());requestFrame();
    }
    function advancePhase() {
      if(!active)return;
      cancelFrame();active.index++;
      if(active.index>=active.phases.length){finishTask();return;}
      active.elapsed=0;active.started=null;active.duration=active.phases[active.index].ms;
      status(active);armPhase();
    }
    function startNext() {
      if(dead||active||!queue.length)return;
      stopAmbient();global.clearTimeout(arrivalTimer);arrivalTimer=0;arrival=null;cancelFrame();
      active=queue.shift();active.index=0;active.elapsed=0;active.started=null;
      active.duration=active.phases[0].ms;active.paused=false;
      status(active);armPhase();
    }
    function finishTask() {
      if(!active)return;
      const item=active;active=null;global.clearTimeout(phaseTimer);phaseTimer=0;cancelFrame();
      status(item,'complete',false);notify(item);
      if(queue.length){startNext();return;}
      if(item.type==='deliver'&&visible()){
        arrival={crew:item.crew,destination:ratio(item.options.destinationRatio,destination)};paint(now());
        arrivalTimer=global.setTimeout(()=>{arrivalTimer=0;arrival=null;clear();scheduleAmbient();},420);
      }else{clear();scheduleAmbient();}
    }
    function enqueue(type,crew,partId,callback,options={}) {
      options=options||{};
      const item={id:++taskId,type,crew,partId,callback,options,notified:false,index:0,
        elapsed:0,duration:1,started:null,paused:false};
      if(type==='retrieve'){
        item.side=['left','right'].includes(options.side)?options.side:(excursionIndex++%2?'right':'left');
        item.phases=[{name:'departing',ms:1450},{name:'searching',ms:950},{name:'returning',ms:1800},{name:'arrived',ms:350}];
      }else if(type==='install'){
        item.phases=[{name:'carrying',ms:2000},{name:'reaching',ms:350},{name:'climbing',ms:650},{name:'fitting',ms:450}];
      }else item.phases=[{name:'carrying',ms:2900}];
      if(dead){notify(item,true);return item.id;}
      queue.push(item);startNext();return item.id;
    }
    function activityChanged() {
      global.clearTimeout(ambientTimer);ambientTimer=0;
      if(active){freezePhase();armPhase();return;}
      if(!moving()){cancelFrame();ambient=null;paint(now());return;}
      scheduleAmbient();
    }

    const observer=global.IntersectionObserver&&canvas?new global.IntersectionObserver(entries=>{
      inView=entries.some(entry=>entry.isIntersecting);activityChanged();
    },{threshold:.01}):null;
    if(observer)observer.observe(canvas);
    const resizeObserver=global.ResizeObserver?new global.ResizeObserver(resize):null;
    if(resizeObserver)[canvas,shadesPortrait,orangePortrait].filter(Boolean).forEach(target=>resizeObserver.observe(target));
    global.addEventListener('resize',resize);
    document.addEventListener('visibilitychange',activityChanged);
    reduced.addEventListener('change',activityChanged);
    load('shades','road-sprite-shades-run-strip.webp');
    load('orange','road-sprite-orange-run-strip.webp');
    load('plate','road-sprite-crew-plate.png');
    resize();scheduleAmbient();

    return{
      setMotion(enabled){motion=!!enabled;activityChanged();},
      deliver(crew='orange',callback){
        if(typeof crew==='function'){callback=crew;crew='orange';}
        return enqueue('deliver',validCrew(crew),null,callback);
      },
      retrieve(partId,callback,options={}){return enqueue('retrieve','orange',String(partId||'component'),callback,options);},
      install(callback,options={}){return enqueue('install','shades',null,callback,options);},
      destroy(){
        if(dead)return;dead=true;cancelFrame();
        [ambientTimer,phaseTimer,arrivalTimer].forEach(timer=>global.clearTimeout(timer));
        ambientTimer=phaseTimer=arrivalTimer=0;
        if(active){status(active,'cancelled',false);notify(active,true);active=null;}
        queue.splice(0).forEach(item=>{status(item,'cancelled',false);notify(item,true);});
        ambient=arrival=null;clear();
        if(observer)observer.disconnect();if(resizeObserver)resizeObserver.disconnect();
        global.removeEventListener('resize',resize);
        document.removeEventListener('visibilitychange',activityChanged);
        reduced.removeEventListener('change',activityChanged);
        Object.values(images).forEach(entry=>{entry.image.onload=entry.image.onerror=null;});
      }
    };
  }
  global.StreamlinerCrew=Object.freeze({create});
})(window);

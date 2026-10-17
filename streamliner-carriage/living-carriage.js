/* A quiet visible-time coordinator. The repair engine and view keep their jobs.
   Events: job-notice; job-arrived {kind,source}; progress-reset;
   salvage-request {partId,source}; vignette {item,index}. All include instant.
   Call activity() when external readiness changes; no readiness polling occurs. */
(function(global){
  'use strict';
  const DEFAULTS={holdMin:45000,holdMax:75000,idle:12000,noticeGrace:8000,eventGap:8000,salvageMin:75000,salvageMax:105000,salvageCooldown:20000,vignetteMin:30000,vignetteMax:45000};
  function create(options={}){
    const engine=options.engine;
    if(!engine||typeof engine.getState!=='function'||typeof engine.subscribe!=='function'||typeof engine.nextJob!=='function')throw new TypeError('A Streamliner repair engine is required.');
    const times={...DEFAULTS};
    for(const [key,value] of Object.entries(options.durations||{}))if(Object.hasOwn(times,key)&&Number.isFinite(value)&&value>=0)times[key]=value;
    times.holdMax=Math.max(times.holdMin,times.holdMax);times.salvageMax=Math.max(times.salvageMin,times.salvageMax);times.vignetteMax=Math.max(times.vignetteMin,times.vignetteMax);
    const vignettes=Array.isArray(options.vignettes)?options.vignettes.slice(0,30):[];
    let snapshot=engine.getState(),started=false,dead=false,visibleFlag=true,inView=true,pageAway=false,running=false,motion=options.motion!==false;
    let clock=0,lastReal=global.performance.now(),timer=0,editing=false,busy=false,lastActivity=0,quietUntil=0;
    let completedAt=null,holdUntil=Infinity,noticeAt=null,completionSignature='',remixing=false,attemptedJob=null,advanceSource=null;
    let salvageIndex=0,vignetteIndex=0,lastSalvage=-Infinity,nextSalvage=Infinity,nextVignette=Infinity;
    let processing=false,publishing=false;
    const signature=state=>`${state.build.power||''}|${state.build.control||''}|${state.build.output||''}|${state.setting}`;
    const empty=()=>Object.values(snapshot.build).every(value=>!value);
    const visible=()=>visibleFlag&&inView&&!document.hidden&&!pageAway&&!dead;
    const enabled=()=>started&&visible();
    const period=(min,max,index,salt)=>min+((Math.max(1,snapshot.logbook.shift)*salt+index*17)%(Math.floor(max-min)+1));
    const now=()=>global.performance.now();
    function sync(){const time=now();if(running)clock+=Math.max(0,time-lastReal);lastReal=time;}
    function state(){
      return {started,destroyed:dead,visible:visible(),motion,editing,busy,jobId:snapshot.activeJob.id,completed:snapshot.activeJob.completed,remixing,visibleTime:clock,idleFor:Math.max(0,clock-lastActivity),noticeOffered:noticeAt!==null,holdRemaining:completedAt===null?0:Math.max(0,holdUntil-clock),phase:!snapshot.activeJob.completed?'working':noticeAt===null?'settled':(editing||busy||remixing)?'waiting':'notice',salvageRemaining:Math.max(0,nextSalvage-clock)};
    }
    function safeCall(name,...args){try{return typeof options[name]==='function'?options[name](...args):undefined;}catch{return undefined;}}
    function publish(){if(publishing)return;publishing=true;try{safeCall('onState',state());}finally{publishing=false;}}
    function event(type,details={}){safeCall('onEvent',{type,jobId:snapshot.activeJob.id,shift:snapshot.logbook.shift,instant:!motion,...details});}
    function cancel(){if(timer)global.clearTimeout(timer);timer=0;}
    function resetCompletion(){completedAt=null;holdUntil=Infinity;noticeAt=null;completionSignature='';remixing=false;attemptedJob=null;}
    function markCompletion(){completedAt=clock;holdUntil=clock+period(times.holdMin,times.holdMax,0,11000);noticeAt=null;completionSignature=signature(snapshot);remixing=false;attemptedJob=null;}
    function idleReady(){return !editing&&!busy&&clock-lastActivity>=times.idle;}
    function readyToAdvance(){
      if(!idleReady())return false;
      if(empty())return true;
      return !remixing&&safeCall('canAdvance',snapshot,state())===true;
    }
    function schedule(){
      cancel();running=enabled();lastReal=now();if(!running)return;
      if(editing||busy)return;
      const idleAt=lastActivity+times.idle;
      let due=Infinity;
      const consider=value=>{if(value>clock)due=Math.min(due,value);};
      if(snapshot.activeJob.completed&&attemptedJob!==snapshot.activeJob.id){
        if(noticeAt===null)consider(Math.max(holdUntil,idleAt,quietUntil));
        else if((empty()||(!remixing&&typeof options.canAdvance==='function')))consider(Math.max(noticeAt+times.noticeGrace,idleAt));
      }
      if(typeof options.onRequestSalvage==='function')consider(Math.max(nextSalvage,idleAt,quietUntil,lastSalvage+times.salvageCooldown));
      if(vignettes.length)consider(Math.max(nextVignette,idleAt,quietUntil));
      // A readiness callback may stay false indefinitely. Recheck only on activity
      // or an engine notification, never in a polling loop.
      if(Number.isFinite(due))timer=global.setTimeout(()=>{timer=0;sync();process();},Math.max(1,due-clock));
    }
    function postponeAmbient(){nextSalvage=Math.max(nextSalvage,clock+times.eventGap);nextVignette=Math.max(nextVignette,clock+times.eventGap);quietUntil=clock+times.eventGap;}
    function performAdvance(source){
      const previous=snapshot.activeJob.id;attemptedJob=previous;advanceSource=source;
      try{engine.nextJob();}finally{advanceSource=null;}
      return snapshot.activeJob.id!==previous;
    }
    function salvage(partId,source){
      const parts=snapshot.parts||[];const part=parts.find(item=>item.id===partId);if(!part)return false;
      lastSalvage=clock;nextSalvage=clock+period(times.salvageMin,times.salvageMax,salvageIndex++,13000);quietUntil=clock+times.eventGap;
      const details={type:'salvage-request',partId,source,instant:!motion,jobId:snapshot.activeJob.id,shift:snapshot.logbook.shift};
      let accepted=true;
      try{if(typeof options.onRequestSalvage==='function')accepted=options.onRequestSalvage(partId,details)!==false;}catch{accepted=false;}
      if(accepted){event('salvage-request',{partId,source});postponeAmbient();}
      return accepted;
    }
    function process(){
      if(processing||dead)return;processing=true;
      try{
        if(!enabled()||!idleReady())return;
        const job=snapshot.activeJob;
        if(job.completed&&noticeAt===null&&clock>=holdUntil&&clock>=quietUntil){noticeAt=clock;event('job-notice',{kind:job.kind});postponeAmbient();return;}
        if(job.completed&&noticeAt!==null&&clock>=noticeAt+times.noticeGrace&&attemptedJob!==job.id&&readyToAdvance()){performAdvance('automatic');return;}
        if(clock<quietUntil)return;
        if(typeof options.onRequestSalvage==='function'&&clock>=nextSalvage&&clock-lastSalvage>=times.salvageCooldown){const parts=snapshot.parts||[];if(parts.length)salvage(parts[salvageIndex%parts.length].id,'ambient');return;}
        if(vignettes.length&&clock>=nextVignette){const index=vignetteIndex++%vignettes.length;event('vignette',{item:vignettes[index],index});nextVignette=clock+period(times.vignetteMin,times.vignetteMax,vignetteIndex,7000);postponeAmbient();}
      }finally{processing=false;publish();schedule();}
    }
    function receive(next){
      if(dead)return;sync();const previous=snapshot,changed=next.activeJob.id!==previous.activeJob.id;
      snapshot=next;
      if(changed){
        resetCompletion();lastActivity=clock;postponeAmbient();
        if(snapshot.activeJob.completed)markCompletion();
        if(started)event(snapshot.logbook.shift<previous.logbook.shift?'progress-reset':'job-arrived',{kind:snapshot.activeJob.kind,source:advanceSource||'external'});
      }else if(snapshot.activeJob.completed&&!previous.activeJob.completed){lastActivity=clock;markCompletion();}
      else if(!snapshot.activeJob.completed&&previous.activeJob.completed){resetCompletion();lastActivity=clock;}
      else if(started){lastActivity=clock;if(snapshot.activeJob.completed&&signature(snapshot)!==completionSignature&&!empty())remixing=true;}
      if(snapshot.activeJob.completed&&completedAt===null)markCompletion();
      if(empty())remixing=false;
      if(!processing){publish();schedule();}
    }
    if(snapshot.activeJob.completed)markCompletion();
    const unsubscribe=engine.subscribe(receive);
    function start(){if(dead||started)return state();started=true;lastReal=now();running=enabled();nextSalvage=clock+period(times.salvageMin,times.salvageMax,0,13000);nextVignette=clock+period(times.vignetteMin,times.vignetteMax,0,7000);publish();schedule();return state();}
    function activity(flags={}){if(dead)return state();sync();lastActivity=clock;if(Object.hasOwn(flags,'editing'))editing=!!flags.editing;if(Object.hasOwn(flags,'busy'))busy=!!flags.busy;process();return state();}
    function setVisible(value){if(dead)return state();sync();visibleFlag=!!value;running=enabled();process();return state();}
    function setMotion(value){if(dead)return state();sync();motion=!!value;publish();return state();}
    function takeNextJob(){if(dead||!started||!visible()||editing||busy||!snapshot.activeJob.completed)return false;sync();const changed=performAdvance('visitor');publish();schedule();return changed;}
    function requestSalvage(partId){
      if(dead||!started||!visible()||editing||busy)return false;sync();if(clock-lastSalvage<times.salvageCooldown)return false;
      const parts=snapshot.parts||[];if(!parts.length)return false;const chosen=partId||parts[salvageIndex%parts.length].id;
      const result=salvage(chosen,'visitor');publish();schedule();return result;
    }
    function activityChanged(){if(dead)return;sync();running=enabled();process();}
    const observer=global.IntersectionObserver&&options.scene?new global.IntersectionObserver(entries=>{sync();const entry=entries.find(item=>item.target===options.scene)||entries[0];if(entry)inView=entry.isIntersecting;activityChanged();},{threshold:.01}):null;
    observer?.observe(options.scene);
    document.addEventListener('visibilitychange',activityChanged);
    const pageHide=()=>{sync();pageAway=true;running=false;cancel();publish();},pageShow=()=>{pageAway=false;activityChanged();};
    global.addEventListener('pagehide',pageHide);global.addEventListener('pageshow',pageShow);
    function destroy(){if(dead)return;sync();dead=true;running=false;cancel();unsubscribe?.();observer?.disconnect();document.removeEventListener('visibilitychange',activityChanged);global.removeEventListener('pagehide',pageHide);global.removeEventListener('pageshow',pageShow);}
    return {start,activity,setVisible,setMotion,takeNextJob,requestSalvage,getState:()=>{sync();return state();},destroy};
  }
  global.StreamlinerLiving=Object.freeze({create});
})(window);

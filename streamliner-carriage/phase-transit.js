/* Local journey clock. The view supplies scenery URLs and owns all audio. */
(function(global){
  'use strict';
  const DEFAULTS={stopped:6000,departing:5000,cruising:20000,charging:1400,accelerating:1100,crossing:1000,resolving:1800,arriving:4000,station:7000,betweenCrossings:22000,short:120};
  const SPEED=.86,PEAK=1.6,RATE=2.8,FRAME_MS=1000/30;
  const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
  const captions={stopped:'A quiet platform. London waits just beyond the glass.',departing:'The station slips behind. The carriage finds its rhythm.',cruising:'Buildings, bridges, little windows. London keeps moving.',charging:'The spatial wards gather. A solid wall is becoming a possibility.',phasing:'For one impossible moment, the city opens around the carriage.',resolving:'Brass, glass, London. Everything finds its place again.',arriving:'The carriage eases towards the next platform.'};
  const status={stopped:'AT THE STATION',departing:'LEAVING THE PLATFORM',cruising:'IN SERVICE',charging:'SPATIAL WARDS CHARGING',phasing:'PHASE CROSSING',resolving:'SOLID AGAIN',arriving:'APPROACHING THE PLATFORM'};
  function create(options={}){
    const {scene,layerA,layerB,statusNode,speedNode,routeNode,captionNode,button}=options;
    const layers=[layerA,layerB],environments=Array.isArray(options.environments)&&options.environments.length?options.environments:['Westminster · riverside','South Bank · evening line','City · after dark'];
    const durations={...DEFAULTS};
    for(const [key,value] of Object.entries(options.durations||{}))if(Object.hasOwn(durations,key)&&Number.isFinite(value)&&value>0)durations[key]=value;
    let started=false,dead=false,motion=options.motion!==false,inView=true,held=false,active=false,pageAway=false;
    let stage='stopped',elapsed=0,speed=0,distance=0,envIndex=0,layerIndex=0,phaseCount=0;
    let stageFrom=0,swapped=false,shortPhase=false,pendingCross=false,firstStop=true,firstCruise=true;
    let raf=0,timer=0,lastReal=0,lastPaint=-Infinity;
    let lastEnvironmentDistance=0;
    const maxDistance=Number.isFinite(options.maxDistanceBetweenCrossings)&&options.maxDistanceBetweenCrossings>0?options.maxDistanceBetweenCrossings:Infinity;
    const now=()=>global.performance.now();
    const visible=()=>!dead&&!pageAway&&!document.hidden&&inView;
    const canRun=()=>started&&visible()&&(motion||shortPhase);
    const atStation=()=>environments[envIndex]?.kind==='station';
    const state=()=>({started,destroyed:dead,stage,speed,distance,distanceSinceCrossing:distance-lastEnvironmentDistance,envIndex,layerIndex,phaseCount,held,motion,paused:started&&(!visible()||(!motion&&!shortPhase)),stageElapsed:elapsed,pendingCross});
    function paintActivity(){if(scene)scene.dataset.paused=String(!started||!visible()||!motion);}
    function call(name,...args){if(typeof options[name]==='function'){try{options[name](...args,state());}catch{/* A view callback must not strand the journey clock. */}}}
    function cue(kind){if(visible())call('onCue',kind);}
    function cancel(){if(raf)global.cancelAnimationFrame(raf);if(timer)global.clearTimeout(timer);raf=timer=0;}
    function phaseLength(){return shortPhase?durations.short:durations.accelerating+durations.crossing;}
    function duration(){
      if(stage==='stopped')return firstStop?durations.stopped:durations.station;
      if(stage==='cruising')return firstCruise?durations.cruising:durations.betweenCrossings;
      if(stage==='phasing')return phaseLength();
      if(shortPhase&&(stage==='charging'||stage==='resolving'))return durations.short;
      return durations[stage];
    }
    function routeLabel(){const environment=environments[envIndex];return typeof environment==='string'?environment:environment?.route||environment?.label||environment?.name||`London district ${envIndex+1}`;}
    function paintSpeed(){if(speedNode)speedNode.textContent=speed===0?'STATIONARY':`${speed.toFixed(2)}×`;call('onSpeed',speed,distance);}
    function paintStage(){
      if(scene){scene.dataset.stage=stage;scene.dataset.motion=motion?'on':'off';scene.dataset.environment=String(envIndex);}
      if(statusNode)statusNode.textContent=stage==='stopped'&&!atStation()?'HELD AT THE SIGNAL':status[stage];
      if(captionNode)captionNode.textContent=stage==='stopped'&&!atStation()?'Held at the signal. The wards remain in service.':captions[stage];
      if(routeNode)routeNode.textContent=routeLabel();
      if(button){button.disabled=shortPhase||['charging','phasing','resolving'].includes(stage);button.setAttribute('aria-busy',String(button.disabled));}
      call('onStage',stage);
    }
    function activateLayer(index){for(let i=0;i<layers.length;i++){const layer=layers[i];if(!layer)continue;layer.dataset.active=String(i===index);layer.classList.toggle('is-active',i===index);}}
    function swapEnvironment(){
      if(swapped)return;swapped=true;envIndex=(envIndex+1)%environments.length;layerIndex=1-layerIndex;phaseCount++;lastEnvironmentDistance=distance;
      call('onEnvironment',envIndex,layerIndex);activateLayer(layerIndex);
      if(routeNode)routeNode.textContent=routeLabel();if(scene)scene.dataset.environment=String(envIndex);cue('cross');
    }
    function enter(next){
      stageFrom=speed;stage=next;elapsed=0;
      if(stage==='stopped'){speed=0;pendingCross=false;}
      if(stage==='phasing')swapped=false;
      if(stage==='charging')cue('charge');
      if(stage==='departing'){firstStop=false;cue('depart');}
      if(stage==='resolving')cue('resolve');
      if(stage==='arriving')cue('arrive');
      paintStage();
    }
    // Smoothstep speed has an analytic integral, so distance is independent of FPS.
    function easedIntegral(from,to,length,a,b){
      const x=a/length,y=b/length,F=u=>u*u*u-u*u*u*u/2;
      return from*(b-a)+(to-from)*length*(F(y)-F(x));
    }
    function segment(a,b){
      if(shortPhase||!motion)return {integral:0,end:0};
      const length=duration();
      let from,to;
      if(stage==='stopped')return {integral:0,end:0};
      if(stage==='cruising')return {integral:SPEED*(b-a),end:SPEED};
      if(stage==='departing'){from=stageFrom;to=SPEED;}
      else if(stage==='arriving'){from=stageFrom;to=0;}
      else if(stage==='charging'){from=stageFrom;to=1.05;}
      else if(stage==='resolving'){from=stageFrom;to=SPEED;}
      else{
        if(a>=durations.accelerating)return {integral:PEAK*(b-a),end:PEAK};
        const end=Math.min(b,durations.accelerating),x=end/durations.accelerating;
        const integral=easedIntegral(stageFrom,PEAK,durations.accelerating,a,end)+Math.max(0,b-end)*PEAK;
        return {integral,end:b>=durations.accelerating?PEAK:stageFrom+(PEAK-stageFrom)*(3*x*x-2*x*x*x)};
      }
      const x=b/length;return {integral:easedIntegral(from,to,length,a,b),end:from+(to-from)*(3*x*x-2*x*x*x)};
    }
    function transition(){
      if(stage==='stopped'){if(held)return false;enter('departing');}
      else if(stage==='departing'){if(pendingCross){pendingCross=false;enter('charging');}else enter('cruising');}
      else if(stage==='cruising'){
        firstCruise=false;
        if(held)enter('arriving');else enter('charging');
      }
      else if(stage==='charging'){
        enter('phasing');if(shortPhase)swapEnvironment();
      }
      else if(stage==='phasing'){if(!swapped)swapEnvironment();enter('resolving');}
      else if(stage==='resolving'){
        if(shortPhase){shortPhase=false;firstStop=false;enter('stopped');}
        else if(held||atStation())enter('arriving');else{firstCruise=false;enter('cruising');}
      }
      else if(stage==='arriving'){
        const requested=pendingCross;firstStop=false;enter('stopped');if(requested){pendingCross=true;enter('departing');}
      }
      return true;
    }
    function advance(delta){
      let guard=0;
      while(delta>0&&guard++<100){
        if(stage==='stopped'&&held){speed=0;break;}
        const distanceGuard=(stage==='cruising'||stage==='departing')&&!held&&motion&&!shortPhase&&Number.isFinite(maxDistance);
        const budget=distanceGuard?maxDistance-(distance-lastEnvironmentDistance):Infinity;
        if(budget<=.0000001){firstCruise=false;pendingCross=false;enter('charging');continue;}
        const length=duration();let remaining=length-elapsed;
        if(distanceGuard&&stage==='cruising')remaining=Math.min(remaining,budget/(SPEED*RATE)*1000);
        if(stage==='phasing'&&!shortPhase&&!swapped)remaining=Math.min(remaining,durations.accelerating-elapsed);
        const step=Math.min(delta,Math.max(0,remaining));
        if(step>0){const values=segment(elapsed,elapsed+step);distance+=values.integral/1000*RATE;speed=clamp(values.end,0,PEAK);elapsed+=step;delta-=step;}
        if(stage==='phasing'&&!shortPhase&&!swapped&&elapsed>=durations.accelerating)swapEnvironment();
        if((stage==='cruising'||stage==='departing')&&distanceGuard&&distance-lastEnvironmentDistance>=maxDistance-.0000001){firstCruise=false;pendingCross=false;enter('charging');continue;}
        if(elapsed>=length){if(!transition())break;}else if(step===0)break;
      }
    }
    function synchronize(){const time=now();if(active)advance(Math.max(0,time-lastReal));lastReal=time;}
    function schedule(){
      cancel();active=canRun();lastReal=now();
      paintActivity();
      if(!active)return;
      if(stage==='stopped'&&held)return;
      if(stage==='stopped'||shortPhase){timer=global.setTimeout(()=>{timer=0;synchronize();paintSpeed();schedule();},Math.max(1,duration()-elapsed));return;}
      raf=global.requestAnimationFrame(frame);
    }
    function frame(time){
      raf=0;if(!canRun()){activityChanged();return;}
      if(time-lastPaint>=FRAME_MS-.1){synchronize();lastPaint=time;paintSpeed();}
      if(stage==='stopped'||shortPhase)schedule();else raf=global.requestAnimationFrame(frame);
    }
    function activityChanged(){synchronize();cancel();active=false;if(visible())paintSpeed();schedule();}
    function start(){
      if(dead||started)return state();started=true;lastReal=now();
      call('onEnvironment',envIndex,layerIndex);activateLayer(layerIndex);paintStage();paintSpeed();schedule();return state();
    }
    function cross(){
      if(dead)return state();if(!started)start();synchronize();
      if(shortPhase||['charging','phasing','resolving'].includes(stage)){schedule();return state();}
      held=false;pendingCross=true;
      if(!motion){shortPhase=true;pendingCross=false;speed=0;enter('charging');}
      else if(stage==='stopped')enter('departing');
      else if(stage==='cruising'){pendingCross=false;enter('charging');}
      schedule();return state();
    }
    function hold(value){
      if(dead)return state();synchronize();held=!!value;
      if(started&&motion){
        if(held&&!['stopped','arriving','charging','phasing','resolving'].includes(stage)){pendingCross=false;enter('arriving');}
        else if(!held&&stage==='stopped')enter('departing');
      }
      paintStage();schedule();return state();
    }
    function setMotion(value){
      if(dead)return state();synchronize();motion=!!value;
      if(!motion){
        speed=0;
        // A preference change during a crossing must not leave its button locked.
        if(started&&['charging','phasing','resolving'].includes(stage)){
          shortPhase=true;elapsed=0;
          if(stage==='phasing'){if(!swapped)swapEnvironment();enter('resolving');}
        }
      }
      paintStage();if(visible())paintSpeed();schedule();return state();
    }
    const observer=global.IntersectionObserver&&scene?new global.IntersectionObserver(entries=>{const entry=entries.find(item=>item.target===scene)||entries[0];if(!entry)return;synchronize();inView=entry.isIntersecting;activityChanged();},{threshold:.01}):null;
    observer?.observe(scene);
    document.addEventListener('visibilitychange',activityChanged);
    const pageHide=()=>{synchronize();pageAway=true;cancel();active=false;paintActivity();},pageShow=()=>{pageAway=false;activityChanged();};
    global.addEventListener('pagehide',pageHide);global.addEventListener('pageshow',pageShow);
    const click=()=>cross();button?.addEventListener('click',click);
    function destroy(){
      if(dead)return;synchronize();dead=true;active=false;cancel();observer?.disconnect();
      document.removeEventListener('visibilitychange',activityChanged);global.removeEventListener('pagehide',pageHide);global.removeEventListener('pageshow',pageShow);button?.removeEventListener('click',click);
      speed=0;if(scene){scene.dataset.stage='stopped';scene.dataset.motion='off';scene.dataset.paused='true';}if(speedNode)speedNode.textContent='STATIONARY';if(button){button.disabled=false;button.setAttribute('aria-busy','false');}
    }
    paintActivity();
    return {start,cross,hold,setMotion,destroy,getState:state};
  }
  global.StreamlinerTransit=Object.freeze({create});
})(window);

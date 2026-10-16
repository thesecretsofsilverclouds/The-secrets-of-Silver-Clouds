/* One local, opt-in narrated room. No analytics, persistence or automatic replay. */
(() => {
  'use strict';
  const host=document.querySelector('.ss-widget');
  const track=host?.querySelector('.ss-room-track');
  if(!host||!track)return;
  const $=selector=>host.querySelector(selector);
  const ui={arrival:$('.ss-room-arrival'),enter:$('.ss-room-enter'),quiet:$('.ss-room-quiet'),presence:$('.ss-room-presence'),state:$('.ss-room-state'),detail:$('.ss-room-detail'),progress:$('.ss-room-progress i'),back:$('.ss-room-return'),volume:$('.ss-room-volume'),level:$('.ss-room-level'),scene:$('.ss-room-scene-text'),sound:$('.ss-sound'),announcement:$('.ss-room-announcement')};
  if(!ui.enter||!ui.quiet||!ui.sound||!ui.volume)return;
  const sceneEntries=[...document.querySelectorAll('[data-room-entry]')];
  const clamp=(value,lo=0,hi=1)=>Math.max(lo,Math.min(hi,value));
  const surfaces=[host,document.getElementById('ss-sanctuary-story')].filter(Boolean);
  const surfaceVisibility=new Map(surfaces.map(surface=>[surface,surfaceVisible(surface)]));
  const clipGains={pour:1,stir:1,taste:.8,clear:.25};
  const effects=new Map([...host.querySelectorAll('audio[data-ss-sfx]')].filter(media=>Object.hasOwn(clipGains,media.dataset.ssSfx)).map(media=>[media.dataset.ssSfx,{media,epoch:0}]));
  const ownedMedia=new Set([track,...[...effects.values()].map(cue=>cue.media)]);
  let level=clamp(Number(ui.volume.value)||0,0,100),lastNonzero=level||32;
  let entered=false,intent=false,blocked=false,failed=false,ended=false,pageAway=false;
  let hasPlayed=false,pending=null,playEpoch=0,fadeEpoch=0,fadeFrame=0,fadeTarget=null;
  let inView=visibleBounds(),otherMedia=false,expectedPauses=0,lastGesture=-Infinity;
  let activeEffect=null,duckUntil=0,duckTimer=0,initialFadeUntil=0;
  const vision=$('.ss-mind-vision');
  track.loop=false;track.autoplay=false;track.volume=0;
  for(const {media} of effects.values()){media.loop=false;media.autoplay=false;media.volume=0;}

  function surfaceVisible(surface){
    const rect=surface.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<innerHeight&&rect.left<innerWidth;
  }
  function visibleBounds(){return surfaces.some(surfaceVisible);}
  function refreshVisibility(){for(const surface of surfaces)surfaceVisibility.set(surface,surfaceVisible(surface));inView=[...surfaceVisibility.values()].some(Boolean);}
  function competitor(){
    return [...document.querySelectorAll('audio,video')].some(media=>!ownedMedia.has(media)&&!media.paused&&!media.ended&&!media.muted&&media.volume>0);
  }
  function roomAllowed(){return entered&&intent&&level>0&&!pageAway&&!document.hidden&&inView&&!otherMedia;}
  function allowed(){return roomAllowed()&&!blocked&&!failed&&!ended;}
  function effectsAllowed(){return roomAllowed()&&host.dataset.mode!=='melters';}
  function duck(){return Math.min(host.dataset.mode==='melters'&&vision?.dataset.link==='linked'?.7:1,performance.now()<duckUntil?.82:1);}
  function target(){return level/100*duck();}
  function say(text){if(ui.announcement)ui.announcement.textContent=text;}
  function cancelFade(){fadeEpoch++;cancelAnimationFrame(fadeFrame);fadeFrame=0;fadeTarget=null;}
  function setTrackLevel(value){try{track.volume=clamp(value);}catch{}}
  function fadeTo(value,duration,done){
    value=clamp(value);
    if(fadeFrame&&fadeTarget===value&&!done)return;
    cancelFade();fadeTarget=value;
    const token=fadeEpoch,from=track.volume,start=performance.now();
    if(!duration||Math.abs(from-value)<.0005){setTrackLevel(value);fadeTarget=null;done?.();return;}
    const frame=now=>{
      if(token!==fadeEpoch)return;
      const progress=clamp((now-start)/duration);
      setTrackLevel(from+(value-from)*(progress*progress*(3-2*progress)));
      if(progress<1)fadeFrame=requestAnimationFrame(frame);
      else{fadeFrame=0;fadeTarget=null;done?.();}
    };
    fadeFrame=requestAnimationFrame(frame);
  }
  function pauseTrack(){
    if(!track.paused){expectedPauses++;track.pause();}
  }
  function stopEffects(except=null){
    for(const cue of effects.values()){
      if(cue===except)continue;
      cue.epoch++;cue.media.volume=0;if(!cue.media.paused)cue.media.pause();
    }
    activeEffect=except;
  }
  function effectLevels(){
    if(!effectsAllowed()){stopEffects();return;}
    for(const [kind,{media}] of effects)media.volume=clamp(level/100*.7*clipGains[kind]);
  }
  function stop(immediate=false){
    playEpoch++;pending=null;initialFadeUntil=0;
    if(immediate||track.paused){cancelFade();setTrackLevel(0);pauseTrack();}
    else fadeTo(0,350,()=>{if(!allowed())pauseTrack();});
  }
  function render(){
    const zero=intent&&level===0;
    let state='unentered',title='The Sanctuary is waiting',detail='Step inside with the narrated scene, or explore quietly.';
    if(entered){
      if(failed){state='error';title='The sound could not find you';detail='The narrated scene could not load. You can try again; the bar is still yours.';}
      else if(ended){state='ended';title='A moment, held in the clouds';detail='The narrated scene has ended. Return when you would like to hear it again.';}
      else if(blocked){state='blocked';title='The scene is waiting for you';detail='Your browser paused the sound. Return to it when you are ready.';}
      else if(!intent||zero){state='quiet';title=zero?'A quiet moment':'The Sanctuary, quietly';detail=zero?'Sound level is at zero. Raise it or restore the sound whenever you like.':'Explore at your own pace. You can enter with sound whenever you like.';}
      else if(pageAway||document.hidden||!inView||otherMedia){state='away';title='Your place is saved';detail=otherMedia?'The scene is resting while other audio plays.':'The scene is resting. It will continue from the same moment when you return.';}
      else if(pending!==null||track.paused){state='loading';title='Step into the scene';detail='The room is opening around you…';}
      else{state='playing';title='You are inside the Sanctuary';detail=host.dataset.mode==='melters'&&vision?.dataset.link==='linked'?'The room softens around your shared thoughts.':'An immersive narrated scene, unfolding around the bar.';}
    }
    host.dataset.roomAudio=state;
    if(ui.arrival)ui.arrival.hidden=entered;
    if(ui.presence)ui.presence.hidden=!entered;
    if(ui.state)ui.state.textContent=title;
    if(ui.detail)ui.detail.textContent=detail;
    if(ui.level)ui.level.textContent=`${Math.round(level)}%`;
    ui.volume.value=String(level);
    ui.sound.setAttribute('aria-pressed',String(intent));
    const retry=entered&&(blocked||failed||ended);
    const label=!entered?'Enter with sound':zero?'Restore sound':intent?'Sound on':'Sound off';
    ui.sound.textContent=label;
    ui.sound.setAttribute('aria-label',!entered?'Enter the Sanctuary with sound':zero?'Restore Sanctuary sound':intent?'Mute Sanctuary sound':'Enter the Sanctuary with sound');
    if(ui.back){ui.back.hidden=!retry;ui.back.textContent=ended?'Return to the scene':failed?'Try the sound again':'Return to sound';}
    const sceneLabel=!entered?'Enter with sound':ended?'Replay the scene':failed?'Try the sound again':blocked?'Return to sound':intent?'Quiet the scene':'Return to sound';
    for(const button of sceneEntries){button.textContent=sceneLabel;button.setAttribute('aria-pressed',String(intent));button.setAttribute('aria-label',sceneLabel);}
  }
  function start({direct=false,first=false}={}){
    if(!allowed()){render();return;}
    if(pending!==null)return;
    cancelFade();
    if(track.paused)setTrackLevel(0);
    const token=++playEpoch;pending=token;
    let result;
    try{
      // Calling play before any await preserves the Enter/pour/sweet gesture.
      result=track.play();
    }catch(error){result=Promise.reject(error);}
    render();
    Promise.resolve(result).then(()=>{
      if(token!==playEpoch){if(!allowed())pauseTrack();return;}
      pending=null;
      if(!allowed()){stop(true);render();return;}
      hasPlayed=true;initialFadeUntil=performance.now()+450;
      fadeTo(target(),450);render();
      if(direct)say('Sanctuary sound on.');
    }).catch(error=>{
      if(token!==playEpoch)return;
      pending=null;
      if(!allowed()){stop(true);render();return;}
      if(error?.name==='NotSupportedError')failed=true;else blocked=true;
      stop(true);render();say(failed?'The narrated scene could not load. You can try the sound again.':'Sound is paused. Use Return to sound to continue.');
    });
  }
  function reconcile({immediate=false,direct=false}={}){
    effectLevels();
    if(!allowed()){stop(immediate||document.hidden||pageAway);render();return;}
    if(track.paused){start({direct,first:!hasPlayed});return;}
    if(pending===null)fadeTo(target(),Math.max(450,initialFadeUntil-performance.now()));
    render();
  }
  let retryPosition=null;
  function enterSound({replay=false}={}){
    const focus=ui.enter===document.activeElement||ui.quiet===document.activeElement?host.querySelector('[role="tab"][aria-selected="true"]'):ui.back===document.activeElement?ui.volume:null;
    entered=true;intent=true;blocked=false;
    if(!level){level=lastNonzero;ui.volume.value=String(level);}
    if(replay&&(ended||track.ended)){ended=false;try{track.currentTime=0;}catch{}}
    if(failed||track.error){
      retryPosition=Number.isFinite(track.currentTime)?track.currentTime:0;failed=false;
      try{track.load();}catch{}
    }
    host.classList.add('ss-room-visit');
    otherMedia=competitor();refreshVisibility();effectLevels();
    if(allowed())start({direct:true,first:!hasPlayed});else reconcile();
    focus?.focus({preventScroll:true});
  }
  function enterQuiet(){
    const focus=ui.enter===document.activeElement||ui.quiet===document.activeElement?host.querySelector('[role="tab"][aria-selected="true"]'):null;
    entered=true;intent=false;blocked=false;
    host.classList.add('ss-room-visit');stopEffects();stop();render();say('Entered quietly. Sound can be enabled at any time.');
    focus?.focus({preventScroll:true});
  }
  function hasGesture(){return navigator.userActivation?navigator.userActivation.isActive:performance.now()-lastGesture<1000;}
  function rememberGesture(event){if(event.isTrusted)lastGesture=performance.now();}
  ['pointerdown','pointerup','keydown','click'].forEach(type=>host.addEventListener(type,rememberGesture,{capture:true,passive:true}));
  ui.enter.addEventListener('click',enterSound);
  ui.quiet.addEventListener('click',enterQuiet);
  ui.back?.addEventListener('click',()=>enterSound({replay:true}));
  sceneEntries.forEach(button=>button.addEventListener('click',event=>{
    if(!event.isTrusted)return;
    if(ended||failed||blocked)enterSound({replay:true});
    else if(intent){intent=false;stopEffects();stop();render();say('Sanctuary sound off. Your place is saved.');}
    else enterSound();
  }));
  ui.sound.addEventListener('click',()=>{
    if(!entered||!intent||!level)enterSound();
    else{intent=false;stopEffects();stop();render();say('Sanctuary sound off. Your place is saved.');}
  });
  ui.volume.addEventListener('input',()=>{
    level=clamp(Number(ui.volume.value)||0,0,100);if(level>0)lastNonzero=level;
    reconcile({direct:true});
  });
  host.addEventListener('click',event=>{
    const sweet=event.target.closest?.('.ss-take-melter');
    if(!entered&&event.isTrusted&&sweet&&!sweet.disabled&&sweet.getAttribute('aria-disabled')!=='true'&&host.dataset.mode==='melters')enterSound();
  },true);

  function effect(kind){
    const cue=effects.get(kind);
    if(!cue||!effectsAllowed())return;
    stopEffects(cue);effectLevels();
    const token=++cue.epoch,media=cue.media;
    try{
      media.currentTime=0;
      // Native one-shots retain file/data-URI compatibility and never seek narration.
      Promise.resolve(media.play()).then(()=>{
        if(token!==cue.epoch){if(activeEffect!==cue||!effectsAllowed())media.pause();return;}
        if(!effectsAllowed()||activeEffect!==cue)media.pause();
      }).catch(()=>{if(token===cue.epoch&&activeEffect===cue)activeEffect=null;});
    }catch{/* Optional effects must never interrupt the narrated scene or mixer. */}
  }
  host.addEventListener('ss:bar-sound',event=>{
    const kind=event.detail?.kind;
    // Only a completed, meaningful pour can bypass an untouched arrival strip.
    if(kind==='pour'&&!entered&&hasGesture())enterSound();
    if(kind==='taste'&&entered&&intent){duckUntil=performance.now()+1600;clearTimeout(duckTimer);duckTimer=setTimeout(()=>reconcile(),1650);reconcile();}
    effect(kind);
  });
  const observer=new MutationObserver(()=>{if(entered)reconcile();});
  observer.observe(host,{attributes:true,attributeFilter:['data-mode']});
  if(vision)observer.observe(vision,{attributes:true,attributeFilter:['data-link']});
  const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries)surfaceVisibility.set(entry.target,entry.isIntersecting);
    inView=[...surfaceVisibility.values()].some(Boolean);if(entered)reconcile();
  },{threshold:0}):null;
  surfaces.forEach(surface=>intersection?.observe(surface));
  if(!intersection){
    const visibility=()=>{refreshVisibility();if(entered)reconcile();};
    window.addEventListener('scroll',visibility,{passive:true,capture:true});window.addEventListener('resize',visibility,{passive:true});
  }
  function mediaChanged(event){if(ownedMedia.has(event.target))return;otherMedia=competitor();if(entered)reconcile();}
  ['play','playing','pause','ended','volumechange','emptied','error'].forEach(type=>document.addEventListener(type,mediaChanged,true));
  document.addEventListener('visibilitychange',()=>{otherMedia=competitor();if(entered)reconcile({immediate:document.hidden});});
  window.addEventListener('pagehide',()=>{pageAway=true;stopEffects();stop(true);render();});
  window.addEventListener('pageshow',()=>{pageAway=false;refreshVisibility();otherMedia=competitor();if(entered)reconcile();});
  track.addEventListener('pause',()=>{
    if(expectedPauses)expectedPauses--;
    else if(allowed()&&pending===null&&!track.ended&&!track.error){intent=false;cancelFade();stopEffects();}
    render();
  });
  track.addEventListener('ended',()=>{ended=true;blocked=false;stop(true);render();say('The narrated scene has ended. Return to the scene to hear it again.');});
  track.addEventListener('error',()=>{failed=true;blocked=false;stop(true);render();if(entered)say('The narrated scene could not load. You can try the sound again.');});
  function progress(){
    const duration=track.duration;
    if(!Number.isFinite(duration)||duration<=0)return;
    if(ui.progress)ui.progress.style.width=`${clamp(track.currentTime/duration)*100}%`;
    if(ui.scene){const seconds=Math.round(duration);ui.scene.textContent=`Immersive excerpt · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
  }
  track.addEventListener('loadedmetadata',()=>{
    if(retryPosition!==null){try{track.currentTime=clamp(retryPosition,0,Math.max(0,track.duration-.05));}catch{}retryPosition=null;}
    progress();
  });
  track.addEventListener('timeupdate',progress);track.addEventListener('durationchange',progress);
  otherMedia=competitor();render();progress();
})();

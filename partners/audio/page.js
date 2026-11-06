/* A listening preview of the existing recording, not the proposed unified engine. */
(() => {
  'use strict';
  const root=document.getElementById('audio-pitch-content')?.shadowRoot || document;
  const audio=root.getElementById('scene-audio');
  const status=root.getElementById('audio-status');
  if(!audio)return;
  const scenes=[
    {at:0,id:'arrival',title:'The city falls away.',caption:'The Sanctuary in the Sky.'},
    {at:90,id:'dance',title:'Step onto the dance floor.',caption:'Ashai and Rose, beneath the stained glass.'},
    {at:165,id:'silver-wing',title:'The Silver Wing appears.',caption:'An ancient guardian of souls.'}
  ];
  let current='arrival';
  let wanted='arrival';
  let pendingSeek=null;
  const artPromises=new Map();
  const frame=root.querySelector('.scene-images');
  function loadArt(scene){
    if(!artPromises.has(scene.id)){
      const image=root.querySelector(`[data-art="${scene.id}"]`);
      image.loading='eager';
      artPromises.set(scene.id,image.decode());
    }
    return artPromises.get(scene.id);
  }
  function renderScene(){
    const scene=[...scenes].reverse().find(s=>audio.currentTime>=s.at)||scenes[0];
    if(scene.id!==wanted){
      wanted=scene.id;
      frame.setAttribute('aria-busy','true');
      loadArt(scene).then(()=>{
        if(wanted!==scene.id)return;
        root.querySelectorAll('[data-art]').forEach(img=>{img.hidden=img.dataset.art!==scene.id;});
        root.getElementById('scene-title').textContent=scene.title;
        root.getElementById('scene-caption').textContent=scene.caption;
        current=scene.id;
        frame.setAttribute('aria-busy','false');
      }).catch(()=>{
        if(wanted!==scene.id)return;
        frame.setAttribute('aria-busy','false');
        status.textContent='The next artwork could not load. Your audio can continue; the previous image stays in view.';
      });
    }
    root.querySelectorAll('[data-cue]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.cue)===scene.at)));
  }
  function applySeek(){if(pendingSeek!==null&&audio.readyState>=1){audio.currentTime=Math.min(pendingSeek,Math.max(0,(audio.duration||257)-.1));pendingSeek=null;renderScene();}}
  audio.addEventListener('loadedmetadata',applySeek);
  root.querySelectorAll('[data-cue]').forEach(button=>{button.disabled=false;button.addEventListener('click',()=>{
    pendingSeek=Number(button.dataset.cue);
    if(audio.readyState>=1) applySeek();
    const playback=audio.play();
    playback?.catch(error=>{if(error.name!=='AbortError')status.textContent='Use the audio player’s play control to continue from this scene.';});
  });});
  audio.addEventListener('timeupdate',renderScene);
  audio.addEventListener('seeked',renderScene);
  audio.addEventListener('play',()=>{
    scenes.slice(1).forEach(scene=>loadArt(scene).catch(()=>{}));
    status.textContent='Now listening. Explore at your own pace; the story continues.';
  });
  audio.addEventListener('pause',()=>{if(!audio.ended)status.textContent='Paused. Continue whenever you’re ready.';});
  audio.addEventListener('ended',()=>{status.textContent='The scene has finished. Step into the full Sanctuary, or explore what could come next.';});
  audio.addEventListener('error',()=>{status.textContent='This recording could not load. The full Sanctuary experience is linked below.';});
  root.querySelectorAll('[data-leave-audio]').forEach(link=>link.addEventListener('click',()=>audio.pause()));
  renderScene();
})();

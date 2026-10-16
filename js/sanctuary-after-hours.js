/* Optional native jukebox. A visitor's explicit play gesture owns the room. */
(() => {
  'use strict';
  const panel=document.querySelector('.ss-after-hours');
  const audio=panel?.querySelector('.ss-jukebox-track');
  if(!panel||!audio)return;
  const $=selector=>panel.querySelector(selector);
  const ui={box:$('.ss-jukebox'),heading:$('.ss-after-hours-heading'),artist:$('.ss-jukebox-artist'),title:$('.ss-jukebox-title'),mood:$('.ss-jukebox-mood'),select:$('.ss-jukebox-select'),play:$('.ss-jukebox-play'),prev:$('.ss-jukebox-prev'),next:$('.ss-jukebox-next'),replay:$('.ss-jukebox-replay'),stop:$('.ss-jukebox-stop'),volume:$('.ss-jukebox-volume'),level:$('.ss-jukebox-level'),loop:$('.ss-jukebox-loop'),status:$('.ss-jukebox-status'),progress:$('.ss-jukebox-progress-track i'),elapsed:$('.ss-jukebox-elapsed'),duration:$('.ss-jukebox-duration')};
  if(!ui.select||!ui.play)return;
  const narration=document.querySelector('.ss-room-track');
  const openers=[...document.querySelectorAll('[data-after-hours-open]')];
  const clamp=value=>Math.max(0,Math.min(100,Number(value)||0));
  let tracks=[],artist='Silent Silver',index=0,state='stopped',epoch=0,wantsPlay=false,pageAway=false,expectedPauses=0,assignedId=null;
  let volume=clamp(ui.volume?.value??32),lastNonzero=volume||32;
  audio.autoplay=false;audio.loop=false;audio.volume=volume/100;

  function emit(name,detail){document.dispatchEvent(new CustomEvent(name,{detail}));}
  function current(){return tracks[index]||null;}
  function audibleCompetitor(){return [...document.querySelectorAll('audio,video')].some(media=>media!==audio&&media!==narration&&!media.hasAttribute('data-ss-sfx')&&!media.paused&&!media.ended&&!media.muted&&media.volume>0);}
  function announce(text){if(ui.status)ui.status.textContent=text;}
  function clock(seconds){if(!Number.isFinite(seconds)||seconds<0)return '—:—';const whole=Math.floor(seconds);return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}`;}
  function progress(){
    const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:Number(current()?.duration);
    if(ui.elapsed)ui.elapsed.textContent=clock(audio.currentTime||0);
    if(ui.duration)ui.duration.textContent=clock(duration);
    if(ui.progress)ui.progress.style.width=`${duration>0?Math.min(100,(audio.currentTime||0)/duration*100):0}%`;
  }
  function publish(next=state){
    state=next;
    if(ui.box)ui.box.dataset.state=state;
    const active=wantsPlay&&(state==='playing'||state==='loading');
    ui.play.textContent=active?'Ⅱ Pause':'▷ Play';
    ui.play.setAttribute('aria-label',active?'Pause After Hours music':'Play After Hours music');
    if(ui.volume)ui.volume.value=String(volume);
    if(ui.level)ui.level.textContent=`${Math.round(volume)}%`;
    emit('ss:jukebox-state',{state,track:current(),audio,volume});
    progress();
  }
  function pauseNative(){if(!audio.paused){expectedPauses++;audio.pause();}}
  function pause(message){
    wantsPlay=false;epoch++;pauseNative();
    if(state!=='stopped'&&state!=='ended'&&state!=='error')publish('paused');else publish();
    if(message)announce(message);
  }
  function reveal({reader=false,focus=false}={}){
    if(reader){emit('ss:room-claim',{owner:'quiet'});if(narration&&!narration.paused)narration.pause();}
    panel.hidden=false;
    for(const button of openers){button.setAttribute('aria-expanded','true');const route=button.closest('.ss-after-hours-route');if(route)route.hidden=true;}
    if(focus)ui.heading?.focus();
    if(state==='stopped')announce('After Hours is open. Choose a track, then press play.');
    emit('ss:after-hours-open',{reader});
  }
  function assign(){
    const track=current();if(!track)return false;
    if(assignedId!==track.id||audio.error){audio.src=track.src;assignedId=track.id;try{audio.load();}catch{}}
    return true;
  }
  function play({restart=false}={}){
    if(!current()||pageAway||document.hidden)return;
    // Ownership is synchronous: narration must stop before native play is called.
    emit('ss:room-claim',{owner:'jukebox'});
    if(narration&&!narration.paused)narration.pause();
    if(audibleCompetitor()){pause('Other audio is playing. Press play when you are ready to return.');return;}
    if(!assign())return;
    if(restart||audio.ended){try{audio.currentTime=0;}catch{}}
    if(volume===0){volume=lastNonzero;audio.volume=volume/100;}
    const token=++epoch;wantsPlay=true;publish('loading');
    let result;try{result=audio.play();}catch(error){result=Promise.reject(error);}
    Promise.resolve(result).then(()=>{
      if(token!==epoch){if(!wantsPlay)pauseNative();return;}
      if(document.hidden||pageAway||audibleCompetitor()){pause('Your place is saved. Press play when you return.');return;}
      publish('playing');announce(`Playing ${current().title}.`);
    }).catch(error=>{
      if(token!==epoch)return;
      wantsPlay=false;pauseNative();publish('error');
      announce(error?.name==='NotAllowedError'?'Your browser paused the music. Press play to try again.':'This track could not load. Try play again, or choose another track.');
    });
  }
  function select(next,{continuePlaying=false}={}){
    pauseNative();wantsPlay=false;epoch++;
    index=(next+tracks.length)%tracks.length;assignedId=null;
    ui.select.value=String(index);
    const track=current();
    if(ui.artist)ui.artist.textContent=`${artist} · Sanctuary selections`;
    if(ui.title)ui.title.textContent=track.title;
    if(ui.mood)ui.mood.textContent=track.mood||'A moment above the city.';
    // A selection alone does not request or decode the music file.
    audio.removeAttribute('src');try{audio.load();}catch{}
    publish('stopped');announce(`${track.title} selected. Press play when you are ready.`);
    if(continuePlaying)play();
  }
  function stop(){wantsPlay=false;epoch++;pauseNative();try{audio.currentTime=0;}catch{}publish('stopped');announce('Music stopped. The Sanctuary rests in ambient silence.');}
  function setVolume(value){volume=clamp(value);if(volume>0)lastNonzero=volume;audio.volume=volume/100;if(volume===0)pause('Music volume is zero. Raise the level and press play to continue.');else publish();}

  openers.forEach(button=>button.addEventListener('click',()=>reveal({reader:true,focus:true})));
  narration?.addEventListener('ended',()=>reveal());
  // Also cover native or third-party narration controls outside the room buttons.
  narration?.addEventListener('play',()=>{if(wantsPlay)pause('The narrated scene is playing. Your music place is saved.');});
  ui.play.addEventListener('click',()=>wantsPlay?pause(`Paused ${current()?.title||'the music'}. Your place is saved.`):play());
  ui.prev?.addEventListener('click',()=>select(index-1,{continuePlaying:wantsPlay}));
  ui.next?.addEventListener('click',()=>select(index+1,{continuePlaying:wantsPlay}));
  ui.replay?.addEventListener('click',()=>play({restart:true}));
  ui.stop?.addEventListener('click',stop);
  ui.select.addEventListener('change',()=>{const next=Number(ui.select.value);if(Number.isInteger(next)&&next>=0&&next<tracks.length)select(next,{continuePlaying:wantsPlay});});
  ui.volume?.addEventListener('input',()=>setVolume(ui.volume.value));
  ui.loop?.addEventListener('change',()=>{audio.loop=ui.loop.checked;announce(audio.loop?'This track will loop.':'Track looping is off.');});
  document.addEventListener('ss:jukebox-command',event=>{
    const command=event.detail||{};
    if(command.action==='pause')pause(command.message);
    else if(command.action==='toggle'){if(wantsPlay)pause('After Hours music paused. Your place is saved.');else play();}
    else if(command.action==='volume')setVolume(command.value);
  });
  document.addEventListener('ss:room-claim',event=>{if(event.detail?.owner!=='jukebox')pause();});
  function mediaChanged(event){if(event.target===audio||event.target===narration||event.target?.hasAttribute?.('data-ss-sfx'))return;if(wantsPlay&&audibleCompetitor())pause('Other audio is playing. Your place is saved.');}
  ['play','playing','volumechange'].forEach(type=>document.addEventListener(type,mediaChanged,true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Your place is saved. Press play when you return.');});
  window.addEventListener('pagehide',()=>{pageAway=true;pause();});
  window.addEventListener('pageshow',()=>{pageAway=false;});
  audio.addEventListener('pause',()=>{if(expectedPauses){expectedPauses--;return;}if(wantsPlay){wantsPlay=false;epoch++;publish('paused');announce('Music paused. Your place is saved.');}});
  audio.addEventListener('playing',()=>{if(!wantsPlay||document.hidden||pageAway||audibleCompetitor())pause();else publish('playing');});
  audio.addEventListener('waiting',()=>{if(wantsPlay)publish('loading');});
  audio.addEventListener('ended',()=>{if(audio.loop)return;wantsPlay=false;epoch++;publish('ended');announce(`${current()?.title||'The track'} has ended. Choose another moment, or replay.`);});
  audio.addEventListener('error',()=>{if(!assignedId)return;wantsPlay=false;epoch++;pauseNative();publish('error');announce('This track could not load. Try play again, or choose another track.');});
  ['timeupdate','loadedmetadata','durationchange','seeked'].forEach(type=>audio.addEventListener(type,progress));

  async function loadPlaylist(){
    try{
      const embedded=document.getElementById('ss-after-hours-playlist');
      let playlist;
      if(embedded)playlist=JSON.parse(embedded.textContent);
      else{const response=await fetch(panel.dataset.playlist||'/data/sanctuary-after-hours.json',{credentials:'same-origin'});if(!response.ok)throw new Error('Playlist unavailable');playlist=await response.json();}
      if(playlist.version!==1||!Array.isArray(playlist.tracks))throw new Error('Unsupported playlist');
      const seen=new Set();
      tracks=playlist.tracks.filter(track=>{
        if(!track||typeof track.id!=='string'||!track.id||seen.has(track.id)||typeof track.title!=='string'||!track.title||typeof track.src!=='string'||!track.src)return false;
        if(!/^(?:\.?\.?\/|\/|https?:\/\/|data:audio\/)/i.test(track.src))return false;
        seen.add(track.id);return true;
      }).map(track=>({...track,palette:Array.isArray(track.palette)?track.palette.filter(color=>/^#[a-f\d]{6}$/i.test(color)).slice(0,3):[]}));
      if(!tracks.length)throw new Error('Empty playlist');
      if(typeof playlist.artist==='string'&&playlist.artist.trim())artist=playlist.artist;
      ui.select.textContent='';
      tracks.forEach((track,number)=>{const option=document.createElement('option');option.value=String(number);option.textContent=`${String(number+1).padStart(2,'0')} · ${track.title}`;ui.select.appendChild(option);});
      [ui.select,ui.play,ui.prev,ui.next,ui.replay,ui.stop].forEach(control=>{if(control)control.disabled=false;});
      select(0);
    }catch{
      ui.select.textContent='';const option=document.createElement('option');option.textContent='Playlist unavailable';ui.select.appendChild(option);
      announce('The After Hours playlist could not load. The Sanctuary is still yours to explore.');publish('error');
    }
  }
  if(narration?.ended)reveal();
  loadPlaylist();
})();

(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StreamlinerNarration=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create({audio,onChange=()=>{},onInterrupted=()=>{},isHidden=()=>document.hidden}){
    let enabled=false,entered=false,playing=false,pending=false,ended=false,failed=false,blocked=false,destroyed=false,epoch=0;
    audio.loop=false;
    audio.preload='none';
    audio.volume=.86;
    const getState=()=>({enabled,entered,playing,pending,ended,failed,blocked,destroyed});
    const publish=()=>{if(!destroyed)onChange(getState());};
    const stop=()=>{playing=false;audio.pause();};
    const handlers={
      playing(){
        if(destroyed||!enabled||isHidden()){stop();return;}
        playing=!audio.paused;pending=false;failed=false;blocked=false;publish();
      },
      pause(){
        // A queued pause from an older request must not interrupt a newer play.
        if(!audio.paused||destroyed)return;
        playing=false;publish();
        if(enabled&&!pending&&!ended&&!audio.ended&&!failed)onInterrupted();
      },
      ended(){
        if(destroyed)return;
        ++epoch;ended=true;playing=false;pending=false;publish();
      },
      error(){
        if(destroyed)return;
        ++epoch;failed=true;playing=false;pending=false;publish();
      }
    };
    for(const [type,handler] of Object.entries(handlers))audio.addEventListener(type,handler);
    function setEnabled(value,{restart=false}={}){
      if(destroyed)return Promise.resolve(false);
      const request=++epoch;
      enabled=Boolean(value);
      if(!enabled){pending=false;stop();publish();return Promise.resolve(false);}
      entered=true;
      if(isHidden()){enabled=false;pending=false;stop();publish();return Promise.resolve(false);}
      if(restart){ended=false;audio.currentTime=0;}
      if(ended){publish();return Promise.resolve(true);}
      const retry=failed;
      failed=false;blocked=false;pending=true;publish();
      try{
        if(!audio.getAttribute('src'))audio.src=audio.dataset.src;
        else if(retry)audio.load();
        // Called in the original tap/click stack, before any Web Audio await.
        const result=audio.play();
        return Promise.resolve(result).then(()=>{
          if(destroyed||request!==epoch){if(destroyed||!enabled)stop();return false;}
          pending=false;
          if(!enabled||isHidden()){enabled=false;stop();publish();return false;}
          playing=!audio.paused;publish();return playing;
        },error=>{
          if(destroyed||request!==epoch)return false;
          pending=false;playing=false;blocked=error?.name==='NotAllowedError';failed=!blocked;publish();return false;
        });
      }catch(error){
        pending=false;playing=false;blocked=error?.name==='NotAllowedError';failed=!blocked;publish();return Promise.resolve(false);
      }
    }
    function destroy(){
      if(destroyed)return;
      destroyed=true;++epoch;enabled=false;pending=false;
      for(const [type,handler] of Object.entries(handlers))audio.removeEventListener(type,handler);
      stop();audio.removeAttribute('src');audio.load();
    }
    return {setEnabled,getState,destroy};
  }
  return {create};
});

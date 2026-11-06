/* Partners overview and immersive-audio tab. */
(() => {
  'use strict';
  const host=document.getElementById('audio-pitch-content');
  const template=document.getElementById('audio-pitch-template');
  const root=host.attachShadow({mode:'open'});
  root.append(template.content.cloneNode(true));
  const audioStylesheet=root.querySelector('link[rel="stylesheet"]');
  const tabs=[...document.querySelectorAll('.partner-tabs [role="tab"]')];
  const overview=document.getElementById('overview-panel');
  const audioPanel=document.getElementById('audio-panel');
  function select(name,{updateUrl=false,focus=false}={}){
    const audioSelected=name==='audio';
    if(!audioSelected)root.querySelector('audio')?.pause();
    overview.hidden=audioSelected;
    audioPanel.hidden=!audioSelected;
    tabs.forEach(tab=>{
      const selected=tab.dataset.partnerTab===name;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex=selected?0:-1;
      if(selected&&focus)tab.focus();
    });
    if(updateUrl)history.replaceState(null,'',audioSelected?'#audio':'#overview');
  }
  function readLocation(){
    const hash=location.hash.slice(1);
    if(hash==='main')return;
    const inAudio=hash==='audio'||Boolean(hash&&root.getElementById(hash));
    select(inAudio?'audio':'overview');
    if(inAudio&&hash!=='audio'){
      if(!audioStylesheet.sheet)return;
      const target=root.getElementById(hash);
      target.tabIndex=-1;
      target.scrollIntoView({block:'start'});
      target.focus({preventScroll:true});
    }
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(tab.dataset.partnerTab,{updateUrl:true}));
    tab.addEventListener('keydown',event=>{
      if(event.altKey||event.ctrlKey||event.metaKey)return;
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next===undefined)return;
      event.preventDefault();
      select(tabs[next].dataset.partnerTab,{updateUrl:true,focus:true});
    });
  });
  root.addEventListener('click',event=>{
    const anchor=event.composedPath().find(item=>item instanceof HTMLAnchorElement);
    if(!anchor||!anchor.getAttribute('href')?.startsWith('#'))return;
    const target=root.getElementById(anchor.getAttribute('href').slice(1));
    if(!target)return;
    event.preventDefault();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.tabIndex=-1;
    target.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
    target.focus({preventScroll:true});
    history.replaceState(null,'','#'+target.id);
  });
  addEventListener('hashchange',readLocation);
  readLocation();
  if(!audioStylesheet.sheet){
    audioStylesheet.addEventListener('load',()=>requestAnimationFrame(readLocation),{once:true});
  }
})();

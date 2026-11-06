/* A paired, browser-local Mind Melter vignette. No visitor data is collected. */
(() => {
  'use strict';
  const host=document.querySelector('.ss-widget');
  const bank=window.SilverCloudsBarThoughts;
  if(!host||!bank)return;
  const $=selector=>host.querySelector(selector);
  const tabs=[...host.querySelectorAll('[role="tab"]')];
  const dock=document.querySelector('.ss-mobile-dock');
  const vision=$('.ss-mind-vision');
  const people=$('.ss-neighbours');
  const sweet=$('.ss-take-melter');
  const drift=$('.ss-drift');
  const close=$('.ss-end-link');
  const motion=()=>!host.classList.contains('ss-motion-off')&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  const emotions=[...host.querySelectorAll('[data-choice]')].map(button=>({id:button.dataset.choice,name:button.querySelector('strong').textContent,color:button.style.getPropertyValue('--choice'),rgb:button.style.getPropertyValue('--choice-rgb')}));
  const patrons=[
    {name:'The window seat',detail:'A coat over the spare stool.',invitation:'They move their coat and offer you the seat. A sweet waits between you.'},
    {name:'The next stool',detail:'A smile over the rim of a glass.',invitation:'They turn towards you, holding out the box. “Together?”'},
    {name:'The end of the bar',detail:'Keeping time with one fingertip.',invitation:'They stop tapping, meet your eye and slide the sweets a little closer.'},
    {name:'The late arrival',detail:'Rain still shining on their sleeves.',invitation:'They settle beside you and open the box with a small, questioning smile.'},
    {name:'The familiar stranger',detail:'The one who always saves a seat.',invitation:'They nod towards the spare stool. Two sweets are already set out.'},
    {name:'The quiet corner',detail:'A sketchbook closed for the night.',invitation:'They put down their pencil and hold out a sweet. You each take one.'},
    {name:'The last dancer',detail:'Still smiling from the dance floor.',invitation:'They catch their breath and offer the box. You both reach for a sweet.'}
  ];
  const shuffle=array=>{const copy=[...array];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
  const bags=new Map(),recent=new Map();
  let roster=[],selected=0,phase='unlinked',generation=0,linkTimer=null,batches=0;
  const neighbour=()=>roster[selected];
  const status=()=>phase==='linked'?'A shared connection · let the thoughts drift':phase==='linking'?'Two sweets dissolving · a connection opening':'Choose a neighbour · take a sweet together';

  function render(){
    const p=neighbour();if(!p)return;
    host.style.setProperty('--ss-mind',p.emotion.color);
    host.style.setProperty('--ss-mind-rgb',p.emotion.rgb);
    vision.dataset.link=phase;
    people.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===selected)));
    $('.ss-invitation-title').textContent=phase==='linked'?'A little closer now.':phase==='linking'?'For a moment, neither of you speaks.':`${p.emotion.name}, in their glass.`;
    $('.ss-invitation-copy').textContent=phase==='linked'?`They’ve been drinking ${p.emotion.name.toLowerCase()}. Stay a moment and see where their thoughts wander.`:p.invitation;
    $('.ss-link-state').textContent=phase==='linked'?'Connection open':phase==='linking'?'The room falls quiet…':'Two sweets. Two minds.';
    $('.ss-mind-placeholder').hidden=phase==='linked';
    $('.ss-thought-experience').hidden=phase!=='linked';
    $('.ss-thought-person').textContent=p.name;
    $('.ss-thought-emotion').textContent=`Sipping ${p.emotion.name.toLowerCase()}`;
    $('.ss-thought-counter').textContent=`${batches*3} thoughts shared`;
    sweet.setAttribute('aria-disabled',String(phase!=='unlinked'));
    sweet.innerHTML=phase==='linked'?'Connection open <span aria-hidden="true">✧</span>':phase==='linking'?'A sweet dissolves… <span aria-hidden="true">✧</span>':'Take one together <span aria-hidden="true">✧</span>';
    close.hidden=phase==='unlinked';
    drift.disabled=phase!=='linked';
    if(host.dataset.mode==='melters')$('.ss-bar-status').textContent=status();
  }
  function endLink(){
    generation++;clearTimeout(linkTimer);linkTimer=null;phase='unlinked';batches=0;
    vision.classList.remove('ss-mind-opening','ss-thought-enter');
    $('.ss-thought-stream').replaceChildren();render();
  }
  function newNeighbours(){
    endLink();
    const moods=shuffle(emotions);
    roster=shuffle(patrons).slice(0,3).map((p,index)=>({...p,emotion:moods[index]}));selected=0;
    people.replaceChildren(...roster.map((p,index)=>{
      const button=document.createElement('button');button.type='button';button.className='ss-neighbour';
      button.style.setProperty('--neighbour',p.emotion.color);
      button.setAttribute('aria-pressed',String(index===0));
      button.innerHTML='<span class="ss-neighbour-glass" aria-hidden="true"><i></i></span><span><strong></strong><small></small></span><span class="ss-neighbour-drink"></span>';
      button.querySelector('strong').textContent=p.name;button.querySelector('small').textContent=p.detail;button.querySelector('.ss-neighbour-drink').textContent=p.emotion.name;
      button.addEventListener('click',()=>{if(index===selected)return;endLink();selected=index;render();});return button;
    }));render();
  }
  function drawThoughts(){
    const id=neighbour().emotion.id;
    const last=recent.get(id)||[],batch=[];
    for(let i=0;i<3;i++){
      let bag=bags.get(id)||[];
      if(!bag.length)bag=shuffle(bank[id].filter(line=>!last.includes(line)&&!batch.includes(line)));
      batch.push(bag.shift());bags.set(id,bag);
    }
    recent.set(id,batch);
    const stream=$('.ss-thought-stream');
    stream.replaceChildren(...batch.map((line,index)=>{const paragraph=document.createElement('p');paragraph.className='ss-thought';paragraph.style.setProperty('--thought-delay',`${index*110}ms`);paragraph.textContent=line;return paragraph;}));
    batches++;vision.classList.remove('ss-thought-enter');void vision.offsetWidth;vision.classList.add('ss-thought-enter');render();
  }
  function takeTogether(){
    if(phase!=='unlinked')return;
    const token=++generation;phase='linking';vision.classList.add('ss-mind-opening');render();
    if(matchMedia('(max-width:760px)').matches)vision.scrollIntoView({behavior:motion()?'smooth':'auto',block:'center'});
    linkTimer=setTimeout(()=>{
      if(token!==generation||host.dataset.mode!=='melters')return;
      linkTimer=null;phase='linked';render();drawThoughts();
      // Focus follows the new action only when the original button still owns it.
      if(document.activeElement===sweet)drift.focus({preventScroll:true});
    },motion()?1050:0);
  }
  function setMode(mode){
    if(mode!=='melters')endLink();
    host.dataset.mode=mode;
    $('.ss-announcement').textContent='';
    tabs.forEach(tab=>{const active=tab.id===`ss-tab-${mode}`;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;});
    dock?.classList.toggle('ss-dock-melters',mode==='melters');
    if(mode==='melters')render();else $('.ss-bar-status').textContent=host.dataset.sipStatus||'Choose a feeling to begin';
  }
  tabs.forEach((tab,index)=>{
    const activate=()=>setMode(tab.id==='ss-tab-melters'?'melters':'sips');tab.addEventListener('click',activate);
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;
      tabs[target].focus();tabs[target].click();
    });
  });
  sweet.addEventListener('click',takeTogether);
  drift.addEventListener('click',()=>{if(phase==='linked')drawThoughts();});
  close.addEventListener('click',()=>{endLink();sweet.focus({preventScroll:true});});
  $('.ss-new-neighbours').addEventListener('click',newNeighbours);
  window.addEventListener('pagehide',endLink);
  newNeighbours();setMode('sips');
})();

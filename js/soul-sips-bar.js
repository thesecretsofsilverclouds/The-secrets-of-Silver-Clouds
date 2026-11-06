/* Local Soul Sips mixing exhibit. Every action is browser-local. */
(() => {
  'use strict';
  const host = document.querySelector('.ss-widget');
  if (!host) return;
  const feelings = [
    {id:'nostalgia',name:'Nostalgia',color:'#72b6ff',rgb:'114,182,255',flavour:'Bittersweet memories',description:'Deep blue and bittersweet. Laughter and loss in the same mouthful.',taste:'Sweet memories return with their ache still in them. Laughter and tears, close enough to taste together.',fragment:'sweet and bittersweet memories',source:'Ashai’s choice'},
    {id:'joy',name:'Joy',color:'#ffd16b',rgb:'255,209,107',flavour:'Sunshine',description:'Golden joy. The taste of sunshine, held in a little glass.',taste:'Golden sunshine on the senses. A brief, bright rush of joy.',fragment:'the golden taste of sunshine',source:'From the Sanctuary’s emotion menu'},
    {id:'love',name:'Love',color:'#f39ecb',rgb:'243,158,203',flavour:'Warmth',description:'Rose-pink love. A feeling that tastes like warmth.',taste:'Rose-pink warmth fills the senses. A brief, intense feeling of love.',fragment:'rose-pink warmth',source:'From the Sanctuary’s emotion menu'},
    {id:'glory',name:'Glory',color:'#ff9d6b',rgb:'255,157,107',flavour:'Burning intensity',description:'Goaden’s fiery red choice: the burning, overwhelming intensity of glory.',taste:'A burning rush of intensity and reverence. For a moment, glory fills everything else.',fragment:'the burning intensity of glory',source:'Goaden’s choice'},
    {id:'sadness',name:'Sadness',color:'#7a9cf5',rgb:'122,156,245',flavour:'Rain',description:'Deep-blue sadness. At the Sanctuary, it tastes like rain.',taste:'Rain on the senses. A quiet-looking glass, carrying an intense feeling of sadness.',fragment:'the deep-blue taste of rain',source:'From the Sanctuary’s emotion menu'},
    {id:'anger',name:'Anger',color:'#ff617a',rgb:'255,97,122',flavour:'Fire',description:'Crimson anger. Sharp and fierce, with the taste of fire.',taste:'Crimson fire floods the senses. Anger arrives as a brief, fierce rush.',fragment:'crimson fire',source:'From the Sanctuary’s emotion menu'},
    {id:'homecoming',name:'Homecoming',color:'#eac18a',rgb:'234,193,138',flavour:'Loyalty and love',description:'Yukon’s choice: a soldier coming home to his dog. Warm gold, loyalty and love.',taste:'The warmth of being met by someone who never stopped waiting. Loyalty and love, without a word.',fragment:'the warmth of loyalty and love',source:'Yukon’s choice'}
  ];
  const byId = id => feelings.find(f=>f.id===id);
  const asset = key => `/images/soul-sips-mixer/${key}.webp`;
  const $ = selector => host.querySelector(selector);
  const shelf = $('.ss-choices');
  shelf.innerHTML = feelings.map(f=>`<button type="button" class="ss-choice" data-choice="${f.id}" aria-pressed="${f.id==='nostalgia'}" aria-label="Select ${f.name}, ${f.flavour}" style="--choice:${f.color};--choice-rgb:${f.rgb}"><span class="ss-in-glass-dot" aria-hidden="true"></span><span class="ss-shelf-bottle" aria-hidden="true"><span class="ss-bottle-neck"></span><span class="ss-bottle-body"><i></i></span></span><strong>${f.name}</strong></button>`).join('');
  const bottles = [...shelf.querySelectorAll('[data-choice]')];
  const pourButton = $('[data-action="pour"]');
  const stirButton = $('[data-action="stir"]');
  const tasteButton = $('[data-action="taste"]');
  const clearButton = $('[data-action="clear"]');
  const glassTarget = $('.ss-glass-target');
  const ghost = document.querySelector('.ss-drag-ghost');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {selected:'nostalgia',mix:[],phase:'empty',busy:false,epoch:0,motion:!media.matches,pouringId:null};
  const cache = new Map();
  const timers = new Set();
  let drag = null;
  let stirDrag = null;
  let ignoreBottleClickUntil = 0;
  let ignoreGlassClickUntil = 0;
  const total = () => state.mix.reduce((sum,item)=>sum+item.measures,0);
  const names = () => state.mix.map(item=>byId(item.id).name).join(' + ');
  const announce = text => { if(host.dataset.mode!=='melters')$('.ss-announcement').textContent=text; };
  const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const later = (fn,ms) => { const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer); };
  const revealGlass = () => { if(matchMedia('(max-width:760px)').matches) $('.ss-stage').scrollIntoView({behavior:state.motion?'smooth':'auto',block:'center'}); };

  function loadSpirit(id) {
    if (!cache.has(id)) {
      const image = new Image();
      const promise = new Promise((resolve,reject)=>{
        image.onload=async()=>{try{await image.decode();}catch{}resolve(image);};
        image.onerror=()=>{cache.delete(id);reject(new Error('Spirit artwork unavailable'));};
      });
      image.src=asset(`spirit-${id}`);
      cache.set(id,promise);
    }
    return cache.get(id);
  }
  function note(kicker,copy) {
    $('.ss-aftertaste-kicker').textContent=kicker;
    $('.ss-aftertaste-copy').textContent=copy;
  }
  function palette() {
    const first=byId(state.mix[0]?.id||state.selected);
    const second=byId(state.mix[1]?.id||first.id);
    const selected=byId(state.selected);
    host.style.setProperty('--ss-accent',first.color);
    host.style.setProperty('--ss-rgb',first.rgb);
    host.style.setProperty('--ss-second',second.color);
    host.style.setProperty('--ss-pour-color',byId(state.pouringId||state.selected).color);
    $('.ss-selected-name').style.color=selected.color;
    const gradient=$('#ss-fluid');
    const layered=state.phase==='poured'||state.phase==='stirring';
    const split=state.mix.length===2?100*state.mix[1].measures/total():50;
    const stops=state.mix.length===2&&layered?[[0,second.color],[split,second.color],[Math.min(100,split+.5),first.color],[100,first.color]]:[[0,second.color],[100,first.color]];
    gradient.replaceChildren(...stops.map(([offset,color])=>{
      const stop=document.createElementNS('http://www.w3.org/2000/svg','stop');
      stop.setAttribute('offset',offset+'%');stop.setAttribute('stop-color',color);return stop;
    }));
    $('.ss-meniscus').setAttribute('fill',second.color);
    $('.ss-fluid-body').style.transform=`translateY(${total()?5+190*(1-total()/4):205}px)`;
  }
  function render() {
    const selected=byId(state.selected);
    const measures=total();
    const third=state.mix.length>=2&&!state.mix.some(item=>item.id===state.selected);
    const revealed=['ready','tasted'].includes(state.phase);
    host.dataset.phase=state.phase;
    host.classList.toggle('ss-has-blend',state.mix.length===2);
    palette();
    bottles.forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.choice===state.selected));
      button.classList.toggle('ss-in-glass',state.mix.some(item=>item.id===button.dataset.choice));
    });
    $('.ss-selected-name').textContent=selected.name;
    $('.ss-selected-description').textContent=selected.description;
    $('.ss-fill-label').textContent=`${measures} / 4 measures`;
    $('.ss-fill-track').setAttribute('aria-valuenow',String(measures*25));
    $('.ss-fill-track').setAttribute('aria-valuetext',`${measures} of 4 measures${measures?', '+names():''}`);
    $('.ss-fill-track>i').style.width=measures*25+'%';
    $('.ss-recipe-list').innerHTML=state.mix.length?state.mix.map(item=>{const f=byId(item.id);return `<span class="ss-recipe-chip" style="--chip-color:${f.color}"><i aria-hidden="true"></i>${f.name}<small>${Math.round(item.measures/measures*100)}%</small></span>`;}).join(''):'<p class="ss-empty-recipe">Start with one feeling. Add another if you like.</p>';
    pourButton.disabled=state.busy||measures>=4||third;
    stirButton.disabled=state.busy||!measures;
    tasteButton.disabled=state.busy||!revealed;
    clearButton.disabled=!measures;
    glassTarget.disabled=state.busy||!measures;
    $('.ss-pour-label').textContent=measures>=4?'Your glass is full':`Pour ${selected.name}`;
    $('.ss-stir-label').textContent=state.phase==='stirring'?'Stirring…':revealed?'Stir again':'Stir your blend';
    $('.ss-taste-label').textContent=state.phase==='tasted'?'Relive the feeling':'Take a sip';
    $('.ss-pour-help').textContent=third?'Two feelings are already in your glass. Empty it to try another pairing.':measures>=4?'Your glass is full. Stir and taste, or start with an empty glass.':'Each pour adds one measure. Blend up to two feelings.';
    $('.ss-caption-title').textContent=measures?names():'A glass of possibility.';
    $('.ss-caption-note').textContent=state.phase==='tasted'?'Your feeling, by the glass':revealed?'Your blend, awakened':measures?'In the making':'Make yourself something';
    $('.ss-caption-sub').textContent=state.phase==='tasted'?$('.ss-aftertaste-copy').textContent:!measures?'Seven feelings. One little glass.':state.phase==='poured'?'Stir to let the feeling emerge.':state.phase==='stirring'?'A little alchemy. A little you.':state.mix.length===1?byId(state.mix[0].id).source:'Two feelings. Your own balance.';
    $('.ss-stage-state').textContent=!measures?'Your glass awaits':state.phase==='stirring'?'The feeling is waking':state.phase==='tasted'?'The feeling is yours':revealed?'Ready to feel':`${measures} ${measures===1?'measure':'measures'} poured`;
    host.dataset.sipStatus=!measures?'Choose a feeling to begin':state.busy?state.phase==='stirring'?'Stirring your blend…':'Pouring a measure…':state.phase==='poured'?'Your blend is poured · stir when you’re ready':state.phase==='tasted'?'A brief, intense feeling · linger a moment':'Your Soul Sip is ready to taste';
    if(host.dataset.mode!=='melters') $('.ss-bar-status').textContent=host.dataset.sipStatus;
    $('.ss-spirits').classList.toggle('ss-visible',revealed);
    document.querySelector('[data-mobile-action="pour"]').disabled=pourButton.disabled;
    document.querySelector('[data-mobile-action="stir"]').disabled=stirButton.disabled;
    document.querySelector('[data-mobile-action="taste"]').disabled=tasteButton.disabled;
    document.querySelector('[data-mobile-action="clear"]').disabled=clearButton.disabled;
    document.querySelector('.ss-mobile-pour-label').textContent=measures>=4?'Glass full':`Pour ${selected.name}`;
  }
  function select(id) {
    if (!byId(id)) return;
    state.selected=id;render();
    loadSpirit(id).catch(()=>{});
  }
  async function pour() {
    if (state.busy||total()>=4) return;
    let item=state.mix.find(item=>item.id===state.selected);
    if (!item&&state.mix.length>=2) {announce('Your glass holds two feelings. Empty it to try a different pairing.');return;}
    const token=++state.epoch;
    state.pouringId=state.selected;
    if (item) item.measures++;else state.mix.push({id:state.selected,measures:1});
    state.busy=true;state.phase='poured';
    host.classList.remove('ss-stirring','ss-sipping','ss-pouring');
    $('.ss-art-status').hidden=true;
    note('The feeling is taking shape.',state.mix.length===2?'Two colours, still in layers. Stir to bring them together.':'Add another feeling, or stir to see this one emerge.');
    render();revealGlass();
    void host.offsetWidth;host.classList.add('ss-pouring');
    play('pour');loadSpirit(state.selected).catch(()=>{});
    await wait(state.motion?1000:0);
    if (token!==state.epoch) return;
    state.busy=false;state.pouringId=null;host.classList.remove('ss-pouring');render();
    announce(`${byId(item?.id||state.mix[state.mix.length-1].id).name} poured. ${total()} of 4 measures. ${names()}. Ready to stir.`);
  }
  async function stir() {
    if (state.busy||!total()) return;
    const token=++state.epoch;
    const mix=state.mix.map(item=>({...item}));
    state.busy=true;state.phase='stirring';host.classList.remove('ss-sipping');host.classList.add('ss-stirring');
    note('A little stir. A different world.','Watch the colours find one another.');render();revealGlass();play('stir');
    const [images]=await Promise.all([Promise.allSettled(mix.map(item=>loadSpirit(item.id))),wait(state.motion?1150:0)]);
    if(token!==state.epoch)return;
    let missing=false;
    ['.ss-spirit-one','.ss-spirit-two'].forEach((selector,index)=>{
      const image=$(selector);
      if(mix[index]&&images[index].status==='fulfilled'){image.src=asset(`spirit-${mix[index].id}`);image.style.visibility='visible';}
      else{image.removeAttribute('src');image.style.visibility='hidden';if(mix[index])missing=true;}
    });
    $('.ss-art-status').hidden=!missing;
    $('.ss-art-status').textContent=missing?'Your blend is ready. A spirit artwork could not load; stir again to retry.':'';
    state.busy=false;state.phase='ready';host.classList.remove('ss-stirring');
    note('Your blend is ready.',mix.length===1?byId(mix[0].id).description:'Your own pairing. Take a sip to discover the two feelings together.');
    render();play('ready');announce(`${names()} stirred. Your Soul Sip is ready to taste.`);
  }
  const pairCopy={
    'joy|nostalgia':'Sunshine threaded through bittersweet memories. A little brightness, with an ache at its heart.',
    'love|sadness':'Warmth meets rain. Two feelings sharing the same small glass.',
    'anger|glory':'Fire on fire. Fury meets the burning intensity of glory, held together for a moment.',
    'homecoming|nostalgia':'The warmth of being welcomed home, with all the memories that make it matter.',
    'homecoming|love':'Rose-pink warmth meets golden loyalty. Two ways of feeling that you belong.',
    'joy|sadness':'Sunshine and rain in the same mouthful. A bright feeling, carrying a quieter one.',
    'love|nostalgia':'Warmth wrapped around a memory. Sweetness and ache, close enough to taste together.',
    'glory|joy':'Golden sunshine meets the burning intensity of glory. A vivid rush, held in one glass.'
  };
  function taste() {
    if(state.busy||host.classList.contains('ss-sipping')||!['ready','tasted'].includes(state.phase))return;
    state.phase='tasted';host.classList.remove('ss-sipping');void host.offsetWidth;host.classList.add('ss-sipping');
    const fs=state.mix.map(item=>byId(item.id));
    const key=fs.map(f=>f.id).sort().join('|');
    const copy=fs.length===1?fs[0].taste:pairCopy[key]||`${fs[0].name} brings ${fs[0].fragment}; ${fs[1].name} brings ${fs[1].fragment}. A brief, intense meeting of the two.`;
    note(`Your ${fs.length===1?'sip':'blend'} · ${names()}`,copy);render();revealGlass();play('taste');
    const token=++state.epoch;later(()=>{if(token===state.epoch)host.classList.remove('ss-sipping');},3600);
  }
  function clearGlass() {
    play('clear');
    state.epoch++;state.mix=[];state.phase='empty';state.busy=false;state.pouringId=null;
    for(const timer of timers)clearTimeout(timer);timers.clear();
    host.classList.remove('ss-pouring','ss-stirring','ss-sipping','ss-drag-over');
    $('.ss-art-status').hidden=true;
    // Keep decoded artwork in place while render() fades the spirits out.
    // Removing src here paints an empty image box during the opacity transition.
    note('A feeling is waiting to happen.','Pour your first measure. The rest is yours.');render();announce('Glass emptied. Choose a feeling and pour again.');
  }
  function setMotion(enabled) {
    state.motion=enabled&&!media.matches;
    host.classList.toggle('ss-motion-off',!state.motion);
    const button=$('.ss-motion');button.setAttribute('aria-pressed',String(state.motion));
    button.setAttribute('aria-label',state.motion?'Turn off ambient motion':'Turn on ambient motion');
    button.innerHTML=`Motion ${state.motion?'on':'off'} <span aria-hidden="true">◌</span>`;
    button.disabled=media.matches;button.title=media.matches?'Following your reduced-motion preference':'';
  }
  function play(kind) {
    host.dispatchEvent(new CustomEvent('ss:bar-sound',{detail:{kind}}));
  }
  bottles.forEach((button,index)=>{
    button.addEventListener('click',()=>{if(Date.now()<ignoreBottleClickUntil)return;select(button.dataset.choice);});
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
      const target=event.key==='Home'?0:event.key==='End'?bottles.length-1:(index+direction+bottles.length)%bottles.length;
      bottles[target].focus();select(bottles[target].dataset.choice);
    });
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||state.busy)return;
      drag={button,id:button.dataset.choice,pointerId:event.pointerId,x:event.clientX,y:event.clientY,started:false};
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove',event=>{
      if(!drag||drag.button!==button||drag.pointerId!==event.pointerId)return;
      if(!drag.started&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>9){drag.started=true;select(drag.id);button.classList.add('ss-being-dragged');ghost.classList.add('ss-dragging');ghost.style.setProperty('--bottle-color',byId(drag.id).color);}
      if(!drag.started)return;
      event.preventDefault();ghost.style.left=event.clientX+'px';ghost.style.top=event.clientY+'px';
      const bounds=glassTarget.getBoundingClientRect();host.classList.toggle('ss-drag-over',event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom);
    });
    const finishDrag=event=>{
      if(!drag||drag.button!==button)return;
      const started=drag.started;
      const bounds=glassTarget.getBoundingClientRect();
      const dropped=started&&event.type!=='pointercancel'&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
      if(started)ignoreBottleClickUntil=Date.now()+350;
      drag=null;button.classList.remove('ss-being-dragged');ghost.classList.remove('ss-dragging');host.classList.remove('ss-drag-over');
      if(dropped)pour();
    };
    button.addEventListener('pointerup',finishDrag);button.addEventListener('pointercancel',finishDrag);
  });
  glassTarget.addEventListener('pointerdown',event=>{
    if(state.busy||!total()||event.button!==0)return;
    const bounds=glassTarget.getBoundingClientRect();
    const cx=bounds.left+bounds.width/2,cy=bounds.top+bounds.height*.53;
    stirDrag={pointerId:event.pointerId,cx,cy,last:Math.atan2(event.clientY-cy,event.clientX-cx),travel:0,moved:false};
    glassTarget.setPointerCapture(event.pointerId);
  });
  glassTarget.addEventListener('pointermove',event=>{
    if(!stirDrag||stirDrag.pointerId!==event.pointerId||state.busy)return;
    const angle=Math.atan2(event.clientY-stirDrag.cy,event.clientX-stirDrag.cx);
    let difference=angle-stirDrag.last;if(difference>Math.PI)difference-=Math.PI*2;if(difference< -Math.PI)difference+=Math.PI*2;
    if(Math.hypot(event.clientX-stirDrag.cx,event.clientY-stirDrag.cy)>12){stirDrag.travel+=Math.abs(difference);if(Math.abs(difference)>.02)stirDrag.moved=true;}
    stirDrag.last=angle;
    if(stirDrag.travel>Math.PI*1.5){ignoreGlassClickUntil=Date.now()+500;stirDrag=null;stir();}
  });
  glassTarget.addEventListener('pointerup',()=>{if(stirDrag?.moved)ignoreGlassClickUntil=Date.now()+250;stirDrag=null;});
  glassTarget.addEventListener('pointercancel',()=>{stirDrag=null;});
  glassTarget.addEventListener('click',()=>{if(Date.now()>=ignoreGlassClickUntil)stir();});
  pourButton.addEventListener('click',pour);stirButton.addEventListener('click',stir);tasteButton.addEventListener('click',taste);clearButton.addEventListener('click',clearGlass);
  document.querySelector('[data-mobile-action="pour"]').addEventListener('click',pour);
  document.querySelector('[data-mobile-action="stir"]').addEventListener('click',stir);
  document.querySelector('[data-mobile-action="taste"]').addEventListener('click',taste);
  document.querySelector('[data-mobile-action="clear"]').addEventListener('click',clearGlass);
  $('.ss-motion').addEventListener('click',()=>setMotion(!state.motion));
  media.addEventListener('change',()=>setMotion(!media.matches));
  setMotion(state.motion);render();
  loadSpirit(state.selected).catch(()=>{});
})();

// The mobile mixing dock belongs to the bar, not the rest of the lore page.
(() => {
 const bar=document.getElementById('soul-sips-bar');
 const dock=document.querySelector('.ss-mobile-dock');
 if(!bar||!dock)return;
 const header=document.querySelector('.lore-header');
 const align=()=>{const padding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;bar.style.scrollMarginTop=Math.max(16,(header?.getBoundingClientRect().height||0)+16-padding)+'px';};
 align();if(header&&'ResizeObserver' in window)new ResizeObserver(align).observe(header);
 const actions=document.querySelector('.sc-lore-actions');
 if(actions&&!actions.querySelector('[data-soul-sips-jump]')){
  const jump=document.createElement('a');jump.href='#soul-sips-bar';jump.className='sc-lore-nav-link sc-lore-read';jump.textContent='Mix a Soul Sip ↓';jump.dataset.soulSipsJump='';
  actions.querySelector('.sc-lore-read')?.classList.remove('sc-lore-read');actions.prepend(jump);
 }
 dock.hidden=true;
 if('IntersectionObserver' in window){
  const afterHours=document.getElementById('ss-after-hours');
  let barVisible=false,musicVisible=false;
  const visibility=new IntersectionObserver(entries=>{
   for(const entry of entries){if(entry.target===bar)barVisible=entry.isIntersecting;else if(entry.target===afterHours)musicVisible=entry.isIntersecting;}
   dock.hidden=!barVisible||musicVisible;
  },{rootMargin:'-95px 0px -15px 0px'});
  visibility.observe(bar);if(afterHours)visibility.observe(afterHours);
 }else{dock.hidden=false;}
})();

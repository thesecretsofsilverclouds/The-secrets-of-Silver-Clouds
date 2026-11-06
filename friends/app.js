/* The Sanctuary bar. Recipes live in URL fragments; this module never persists them. */
(() => {
  'use strict';
  const C=window.SoulSipContent,P=window.SoulSipProtocol,G=window.SoulSipGlass,X=window.SoulSipExchange;
  const $=id=>document.getElementById(id),esc=G.escape,clone=value=>JSON.parse(JSON.stringify(value));
  P.configure(C);
  const receiving=/^\/drink(?:\/|$)/.test(location.pathname);
  const embedded=!receiving&&new URLSearchParams(location.search).get('embed')==='1'&&window.parent!==window;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const defaultDrink=()=>({v:1,glass:'crystal-shot',ingredients:[],seasoning:'pure',stirred:true,bottom:'just-a-drink',track:'be-my-friend',from:'',to:''});
  const parsed=P.parseHash(location.hash);
  const state={drink:defaultDrink(),previous:null,meta:null,selected:'nostalgia',phase:'empty',busy:false,epoch:0,seated:false,playing:false,moreJokes:false};
  const audio=$('room-music');audio.volume=.26;
  let receivePhase='arrival',imageCache=new Map(),audioContext=null,glassKey='';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const total=()=>state.drink.ingredients.reduce((sum,x)=>sum+x.parts,0);
  const item=id=>C.ingredients.find(x=>x.id===id);
  const find=(array,id)=>array.find(x=>x.id===id);
  const announce=text=>{$('announcement').textContent=text;};
  function reveal(id,{scroll=false,focus=false}={}){
    $(id).hidden=false;
    if(scroll)$(id).scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});
    if(focus){$(id).tabIndex=-1;$(id).focus({preventScroll:true});}
  }
  function report(message){announce(message);}
  function track(){return find(C.tracks,state.drink.track)||C.tracks[0];}
  function setTrack({play=state.playing}={}){
    const next=track();
    if(audio.getAttribute('src')!==next.src){audio.src=next.src;audio.load();}
    if(play){
      const promise=audio.play();
      promise?.then(()=>{state.playing=true;renderSound();}).catch(()=>{state.playing=false;renderSound();announce('The music is ready. Use Sound on when you want it.');});
    }
  }
  function renderSound(){
    $('sound-toggle').setAttribute('aria-pressed',String(state.playing));$('sound-toggle').innerHTML=`Sound ${state.playing?'on':'off'} <span aria-hidden="true">♪</span>`;
    $('last-sound').setAttribute('aria-pressed',String(state.playing));$('last-sound').textContent=`♪ ${track().title||track().name} · ${state.playing?'Sound on':'Sound off'}`;
  }
  function sound(kind){
    if(!state.playing)return;
    try{
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==='suspended')void audioContext.resume();
      const time=audioContext.currentTime;
      if(kind==='pour'){
        const length=Math.round(audioContext.sampleRate*.65),buffer=audioContext.createBuffer(1,length,audioContext.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.45;
        const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
        source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1250;gain.gain.setValueAtTime(.001,time);gain.gain.linearRampToValueAtTime(.035,time+.08);gain.gain.exponentialRampToValueAtTime(.001,time+.65);source.connect(filter).connect(gain).connect(audioContext.destination);source.start();
      }else{
        const o=audioContext.createOscillator(),gain=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='sip'?740:1250,time);o.frequency.exponentialRampToValueAtTime(kind==='sip'?370:940,time+.4);gain.gain.setValueAtTime(.014,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.6);o.connect(gain).connect(audioContext.destination);o.start();o.stop(time+.65);
      }
    }catch{/* A quiet visit remains complete. */}
  }
  async function prepareSpirits(drink){
    const promises=drink.ingredients.map(x=>G.spriteFor(x.id)?.src).filter(Boolean).map(src=>{
      if(!imageCache.has(src)){
        const im=new Image();im.src=src;
        imageCache.set(src,im.decode().catch(()=>null));
      }
      return imageCache.get(src);
    });
    await Promise.allSettled(promises);
  }
  function initialise(){
    if(!parsed.ok || (receiving&&!parsed.drink)){
      $('arrival').hidden=true;reveal('error-view');return;
    }
    if(parsed.drink){state.drink=clone(parsed.drink);state.previous=parsed.previous?clone(parsed.previous):null;state.meta=parsed.meta||null;state.selected=state.drink.ingredients[0].id;state.phase='poured';}
    else{
      const q=new URLSearchParams(location.search),feeling=q.get('feeling');
      if(q.get('house')==='1'&&C.feelings.some(f=>f.id===feeling)){
        state.drink.ingredients=[{id:feeling,parts:1}];state.selected=feeling;state.phase='poured';
      }
    }
    const neutral={...defaultDrink(),glass:state.drink.glass};
    $('arrival-glass').innerHTML=G.render(receiving?neutral:{...neutral,ingredients:[{id:'nostalgia',parts:1}]},{reveal:!receiving,labels:false});
    if(receiving){
      document.body.classList.add('receiving');document.body.dataset.receivePhase='sealed';
      $('arrival-title').replaceChildren();
      const line=document.createTextNode(state.drink.to?`${state.drink.to}, this one’s`:'Someone left');
      const br=document.createElement('br'),em=document.createElement('em');em.textContent=state.drink.to?'for you.':'something for you.';
      $('arrival-title').append(line,br,em);
      $('arrival-copy').textContent=state.drink.from?`${state.drink.from} left this behind the bar. It has your name on it.`:'Someone left this behind the bar. It has your name on it.';
      $('arrival').querySelector('.eyebrow').textContent='A LITTLE SOMETHING. JUST FOR YOU.';
      $('arrival-glass').innerHTML=X.sealedMarkup(state.drink);
      $('pour-time').textContent=X.pourTime(state.meta);$('pour-time').hidden=false;
      $('take-seat').innerHTML='Take your seat <span aria-hidden="true">→</span>';
      $('arrival').querySelector('.entry-note').textContent='Unseal it with a little music. A quiet visit is just as welcome.';
      const quiet=document.createElement('button');quiet.type='button';quiet.id='quiet-seat';quiet.className='text-button';quiet.textContent='Take a quiet seat';quiet.addEventListener('click',event=>seat(event,{quiet:true}));$('take-seat').after(quiet);
      document.title='Someone poured you something · The Sanctuary';
    }
    buildChoices();renderComposer();
    $('to-name').value=state.drink.to;$('from-name').value=state.drink.from;
    if(receiving&&state.meta?.kind==='empty-return'){
      $('arrival').hidden=true;document.body.dataset.receivePhase='returned';$('empty-return-title').textContent=state.drink.to?`${state.drink.to} finished it.`:'Your glass came back.';
      $('returned-glass').innerHTML=X.sealedMarkup(state.drink,{empty:true});reveal('empty-return-view');
    }else if(!receiving&&parsed.drink){
      state.drink.ingredients=[];state.phase='empty';state.meta=null;state.seated=true;$('arrival').hidden=true;reveal('composer');
      $('composer-title').innerHTML=state.drink.to?`${state.previous?'One back':'Another one'}<br><em>for ${esc(state.drink.to)}.</em>`:'Your turn<br><em>at the bar.</em>';
      document.querySelector('.bar-intro>p').textContent='A fresh glass. Your own words this time. Choose up to two bottles, then stir and sip.';renderComposer();
    }
    if(embedded){document.body.classList.add('embedded');state.seated=true;$('arrival').hidden=true;reveal('composer');const observer=new ResizeObserver(()=>window.parent.postMessage({type:'soul-sips:height',height:document.body.offsetHeight},location.origin));observer.observe(document.body);}
  }
  function buildChoices(){
    $('suggestions').innerHTML=C.suggestions.map(s=>`<button type="button" data-suggestion="${esc(s.id)}" title="${esc(s.description)}">${esc(s.name)}</button>`).join('');
    $('vessel-choices').innerHTML=C.glasses.map(g=>`<button type="button" class="vessel-choice" data-glass="${esc(g.id)}" aria-pressed="${g.id===state.drink.glass}" title="${esc(g.meaning||g.description)}">${G.svg({...defaultDrink(),glass:g.id})}<strong>${esc(g.name)}</strong><small>${esc(g.description)}</small></button>`).join('');
    for(const [shelf,rows] of [['feelings-shelf',C.feelings],['regulars-shelf',C.regulars]]){
      $(shelf).innerHTML=rows.map((f,i)=>`<button type="button" class="bottle-choice" data-bottle="${esc(f.id)}" ${shelf==='regulars-shelf'&&i>=16?`data-extra-joke ${state.moreJokes?'':'hidden'}`:''} aria-pressed="false" style="--bottle-color:${esc(f.color)}" title="${esc(f.description)}"><span class="bottle-shape" aria-hidden="true"><i>${shelf==='feelings-shelf'?'✧':'✦'}</i></span><strong>${esc(f.name)}</strong></button>`).join('')+(shelf==='regulars-shelf'&&rows.length>16?`<button type="button" class="more-jokes" data-more-jokes aria-expanded="${state.moreJokes}">${state.moreJokes?'The familiar shelf ↑':'More private jokes ↓'}</button>`:'');
    }
    $('private-count').textContent=C.regulars.length;
    $('seasonings').innerHTML=C.seasonings.map(s=>`<button type="button" data-seasoning="${esc(s.id)}" aria-pressed="${s.id===state.drink.seasoning}" title="${esc(s.description||s.line||s.name)}">${esc(s.name)}</button>`).join('');
    $('bottoms').innerHTML=C.bottoms.map(b=>`<button type="button" data-bottom="${esc(b.id)}" aria-pressed="${b.id===state.drink.bottom}">${esc(b.line||b.name||b.text)}</button>`).join('');
    $('song').innerHTML=C.tracks.map(t=>`<option value="${esc(t.id)}">${esc(t.title||t.name)}</option>`).join('');
    $('song').value=state.drink.track;
  }
  function mountMixGlass(){
    const key=JSON.stringify([state.drink.glass,state.drink.ingredients,state.drink.stirred,['ready','tasted'].includes(state.phase)]);
    if(key===glassKey)return;glassKey=key;
    $('mix-glass').innerHTML=G.render(state.drink,{reveal:['ready','tasted'].includes(state.phase)});
  }
  function renderComposer(){
    const selected=item(state.selected)||C.feelings[0],count=total(),ready=['ready','tasted'].includes(state.phase);
    if(C.regulars.findIndex(i=>i.id===state.selected)>=16){state.moreJokes=true;for(const b of document.querySelectorAll('[data-extra-joke]'))b.hidden=false;const more=document.querySelector('[data-more-jokes]');if(more){more.setAttribute('aria-expanded','true');more.textContent='The familiar shelf ↑';}}
    const third=state.drink.ingredients.length===2&&!state.drink.ingredients.some(i=>i.id===state.selected);
    document.documentElement.style.setProperty('--accent',selected.color);
    $('selected-name').textContent=selected.name;$('selected-description').textContent=selected.description;
    $('pour-button').textContent=count>=4?'Your glass is full':`Pour ${selected.name} ↘`;$('pour-button').disabled=state.busy||count>=4||third;
    $('measure-total').textContent=count;
    $('stir-button').disabled=!count||state.busy;$('sip-button').disabled=!ready||state.busy;
    $('layer-button').disabled=!count||state.busy;$('empty-button').disabled=!count||state.busy;
    $('stir-surface').disabled=!count||state.busy;$('stir-cue').textContent=ready?'A little more of something?':'Draw a circle to stir ↻';
    $('glass-state').textContent=!count?'Your glass awaits':state.busy?'The feeling is waking':ready?'Ready when you are':`${count} ${count===1?'measure':'measures'} poured`;
    $('stage-recipe').innerHTML=count?`<strong>${state.drink.ingredients.map(i=>esc(item(i.id).name)).join(' &amp; ')}</strong><span>${state.drink.stirred&&ready?'A little alchemy. A little you.':ready?'Left layered. These two don’t have to mix.':'The first words are in the glass.'}</span>`:'<span>A small glass. Quite a lot of possibility.</span>';
    $('shelf-help').textContent=third?'Two bottles are already in the glass. Remove a measure below to make room.':count>=4?'Four measures. Stir, or leave the layers as they are.':'Up to two bottles. Four measures. The proportions are yours.';
    $('measures').innerHTML=state.drink.ingredients.map(i=>`<span class="measure-pill" style="--pill-color:${esc(item(i.id).color)}"><i aria-hidden="true"></i>${i.parts} ${esc(item(i.id).name)}<button type="button" data-remove="${esc(i.id)}" aria-label="Remove one measure of ${esc(item(i.id).name)}">−</button></span>`).join('');
    for(const button of document.querySelectorAll('[data-bottle]'))button.setAttribute('aria-pressed',String(button.dataset.bottle===state.selected));
    for(const button of document.querySelectorAll('[data-glass]'))button.setAttribute('aria-pressed',String(button.dataset.glass===state.drink.glass));
    for(const button of document.querySelectorAll('[data-seasoning]'))button.setAttribute('aria-pressed',String(button.dataset.seasoning===state.drink.seasoning));
    for(const button of document.querySelectorAll('[data-bottom]'))button.setAttribute('aria-pressed',String(button.dataset.bottom===state.drink.bottom));
    $('glass-choice-label').textContent=find(C.glasses,state.drink.glass).name;
    $('glass-meaning').textContent=find(C.glasses,state.drink.glass).meaning;
    $('seasoning-label').textContent=find(C.seasonings,state.drink.seasoning).name;
    const bottom=find(C.bottoms,state.drink.bottom);$('bottom-label').textContent=bottom.short||bottom.line||bottom.name||bottom.text;
    $('track-label').textContent=track().title||track().name;$('song').value=state.drink.track;
    mountMixGlass();
    if(state.phase==='tasted')renderReading();
  }
  function renderSend(){
    $('send-glass').innerHTML=X.sealedMarkup(state.drink,{name:$('to-name').value.trim()||'Someone worth a seat'});
    $('send-glass').classList.remove('slid-away');
  }
  function invalidateLink(){state.meta=null;$('share-fallback').hidden=true;$('share-link').value='';$('copy-link').textContent='Copy the invitation ↗';renderSend();}
  function changeRecipe(){state.epoch++;state.phase=total()?'poured':'empty';state.busy=false;$('mix-stage').classList.remove('sip-pouring','sip-stirring','sip-tasting');$('mix-reading').hidden=true;$('send-panel').hidden=true;invalidateLink();}
  async function pour(id=state.selected){
    if(state.busy||total()>=4)return;
    let row=state.drink.ingredients.find(i=>i.id===id);
    if(!row&&state.drink.ingredients.length>=2){report('Two feelings are enough for one glass. Remove a measure to change the pairing.');return;}
    if(row)row.parts++;else state.drink.ingredients.push({id,parts:1});
    state.selected=id;changeRecipe();state.busy=true;const token=state.epoch;
    renderComposer();sound('pour');$('mix-stage').classList.add('sip-pouring');
    if(matchMedia('(max-width:740px)').matches)$('mix-stage').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    await wait(reduced.matches?0:750);
    if(token!==state.epoch)return;
    $('mix-stage').classList.remove('sip-pouring');state.busy=false;renderComposer();
    report(`${item(id).name} poured. ${total()} of four measures.`);
  }
  async function stir(layered=false){
    if(state.busy||!total())return;
    changeRecipe();
    state.busy=true;const token=++state.epoch;$('mix-stage').classList.add('sip-stirring');renderComposer();sound('stir');
    await Promise.all([prepareSpirits(state.drink),wait(reduced.matches?0:1000)]);
    if(token!==state.epoch)return;
    state.drink.stirred=!layered;state.phase='ready';state.busy=false;$('mix-stage').classList.remove('sip-stirring');renderComposer();
    report(layered?'Left layered. Your drink is ready.':'Your feelings have found one another. Take a sip.');
  }
  function renderReading(){const reading=C.renderToast(state.drink);$('mix-name').textContent=reading.name;$('mix-toast').textContent=reading.toast;}
  async function sip(){
    if(state.busy||!['ready','tasted'].includes(state.phase))return;
    state.phase='tasted';renderReading();reveal('mix-reading');sound('sip');
    $('mix-stage').classList.remove('sip-tasting');void $('mix-stage').offsetWidth;$('mix-stage').classList.add('sip-tasting');
    report(`${$('mix-name').textContent}. ${$('mix-toast').textContent}`);
    if(matchMedia('(max-width:740px)').matches)reveal('mix-reading',{scroll:true});
  }
  function setShelf(id,{focus=false}={}){
    for(const kind of ['feelings','regulars']){const active=id===kind;$(`${kind}-tab`).setAttribute('aria-selected',String(active));$(`${kind}-tab`).tabIndex=active?0:-1;$(`${kind}-shelf`).hidden=!active;}
    if(focus)$(`${id}-tab`).focus();
  }
  function wireCircle(element,callback){
    let drag=null;
    element.addEventListener('pointerdown',event=>{
      if(element.disabled||event.button!==0)return;
      const rect=element.getBoundingClientRect();drag={x:rect.left+rect.width/2,y:rect.top+rect.height/2,angle:null,sum:0,moved:false};
      element.setPointerCapture(event.pointerId);event.preventDefault();
    });
    element.addEventListener('pointermove',event=>{
      if(!drag)return;
      const angle=Math.atan2(event.clientY-drag.y,event.clientX-drag.x);
      if(drag.angle!==null){let diff=angle-drag.angle;while(diff>Math.PI)diff-=2*Math.PI;while(diff<-Math.PI)diff+=2*Math.PI;drag.sum+=diff;drag.moved ||= Math.abs(diff)>.03;}
      drag.angle=angle;
      if(Math.abs(drag.sum)>4.9){drag=null;callback();}
    });
    const end=()=>{drag=null;};element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);
    element.addEventListener('click',event=>{if(event.detail===0)callback();});
  }
  function wireBottleDrag(){
    let drag=null;
    document.addEventListener('pointerdown',event=>{
      const button=event.target.closest('[data-bottle]');if(!button||event.button!==0)return;
      drag={id:button.dataset.bottle,x:event.clientX,y:event.clientY,ghost:null};
    });
    document.addEventListener('pointermove',event=>{
      if(!drag)return;
      if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>14){
        // On touch, vertical shelf movement remains ordinary page scrolling.
        if(event.pointerType==='touch'&&Math.abs(event.clientY-drag.y)>Math.abs(event.clientX-drag.x)*1.5){drag=null;return;}
        drag.ghost=document.createElement('div');drag.ghost.className='drink-drag';drag.ghost.style.setProperty('--bottle-color',item(drag.id).color);drag.ghost.innerHTML='<span class="bottle-shape"><i>✧</i></span>';document.body.append(drag.ghost);
      }
      if(drag.ghost){drag.ghost.style.left=(event.clientX-22)+'px';drag.ghost.style.top=(event.clientY-35)+'px';const r=$('mix-stage').getBoundingClientRect();$('mix-stage').classList.toggle('drag-over',event.clientX>r.left&&event.clientX<r.right&&event.clientY>r.top&&event.clientY<r.bottom);}
    },{passive:true});
    document.addEventListener('pointerup',event=>{if(!drag)return;const current=drag;drag=null;if(current.ghost){current.ghost.remove();const r=$('mix-stage').getBoundingClientRect();$('mix-stage').classList.remove('drag-over');if(event.clientX>r.left&&event.clientX<r.right&&event.clientY>r.top&&event.clientY<r.bottom)void pour(current.id);}});
    document.addEventListener('pointercancel',()=>{drag?.ghost?.remove();drag=null;$('mix-stage').classList.remove('drag-over');});
  }
  function invitation(){
    if(!$('send-form').reportValidity())return null;
    try{
      state.drink.from=$('leave-unsigned').checked?'':P.normalizeName($('from-name').value);state.drink.to=P.normalizeName($('to-name').value);
      if(!state.drink.to||(!$('leave-unsigned').checked&&!state.drink.from))throw new Error('Add their name, then sign it or choose Leave it unsigned.');
      $('from-name').value=state.drink.from;$('to-name').value=state.drink.to;$('name-error').hidden=true;
      state.meta||={pouredAt:Math.floor(Date.now()/60000),kind:'drink'};renderSend();
      return P.buildLink(state.drink,{base:location.origin+'/drink/'+state.drink.glass+'/',previous:state.previous,meta:state.meta});
    }catch(error){$('name-error').textContent=error.message||'Use short first names, with letters, hyphens or apostrophes.';$('name-error').hidden=false;return null;}
  }
  function showLink(link){$('share-link').value=X.invitationWords(state.drink)+'\n\n'+link;reveal('share-fallback');}
  async function share(event){
    event.preventDefault();const link=invitation();if(!link)return;
    showLink(link);
    $('send-glass').classList.add('slid-away');
    if(navigator.share){try{await navigator.share({title:`A Soul Sip for ${state.drink.to}`,text:X.invitationWords(state.drink),url:link});announce('Your invitation is shared. Their seat is waiting.');return;}catch(error){if(error.name==='AbortError'){$('send-glass').classList.remove('slid-away');announce('No hurry. Their glass is still here.');return;}}}
    showLink(link);announce('Your invitation is ready to copy.');
  }
  async function copy(){
    try{await navigator.clipboard.writeText($('share-link').value);$('copy-link').textContent='Invitation copied ✓';announce('Invitation copied.');}
    catch{$('share-link').focus();$('share-link').select();announce('Select and copy their invitation.');}
  }
  async function seat(event,{quiet=false}={}){
    if(state.seated)return;state.seated=true;$('arrival').hidden=true;
    // This call remains within the visitor's explicit gesture for mobile audio.
    state.playing=!quiet;setTrack({play:!quiet});renderSound();
    if(receiving){document.body.dataset.receivePhase='opening';reveal('receiver',{focus:event?.detail===0});await receiveArrival();}
    else{reveal('composer',{focus:event?.detail===0});renderComposer();if(total())announce('This one’s on the house. A feeling is already poured; one stir from the good part.');}
  }
  async function receiveArrival(){
    $('receive-from').textContent=state.drink.from?`A GLASS FROM ${state.drink.from.toLocaleUpperCase()}`:'A PLACE KEPT FOR YOU';
    $('receive-title').innerHTML=state.drink.to?`${esc(state.drink.to)}, this one’s<br><em>for you.</em>`:'Someone poured<br><em>you something.</em>';
    $('receive-glass').innerHTML=X.sealedMarkup(state.drink);$('receive-glass').classList.add('arriving');
    await wait(reduced.matches?0:2200);receivePhase='poured';
    $('receive-instruction').textContent='A gentle circle. There’s something in there.';
    $('receive-stir').textContent=state.drink.stirred?'Stir it together ↻':'Wake the layers ↻';reveal('receive-stir');reveal('receive-stir-surface');
    $('receive-stir-surface').querySelector('span').textContent=state.drink.stirred?'Draw a circle to stir ↻':'Draw a circle to wake the layers ↻';
    announce('Your glass has arrived. Stir with a circle, or use the stir button.');
  }
  async function receiveAwaken(){
    if(receivePhase!=='poured')return;receivePhase='stirring';$('receive-stir').disabled=true;$('receive-stir-surface').hidden=true;$('receive-bar').classList.add('sip-stirring');sound('stir');
    await Promise.all([prepareSpirits(state.drink),wait(reduced.matches?0:1100)]);
    $('receive-bar').classList.remove('sip-stirring');$('receive-glass').innerHTML=G.render(state.drink,{reveal:true});
    $('receive-bar').classList.add('seal-broken');document.body.dataset.receivePhase='open';
    $('receive-ingredients').textContent=X.recipeWords(state.drink,C);reveal('receive-ingredients');$('receive-stir').hidden=true;reveal('receive-sip');receivePhase='ready';
    const who=state.drink.from||'They';$('chosen-glass').textContent=`${who} chose the ${find(C.glasses,state.drink.glass).name}.`;$('chosen-meaning').textContent=find(C.glasses,state.drink.glass).meaning;
    $('chosen-song').textContent=`♪ ${who} chose “${track().title||track().name}” for this drink.`;reveal('chosen-details');
    $('receive-instruction').textContent=state.drink.stirred?'Two people. A little less left unsaid.':'Left layered, just as they poured it.';
    $('receive-sip').focus({preventScroll:true});
    announce('The feelings have risen. Take a sip when you’re ready.');
  }
  async function receiveSip(){
    if(receivePhase!=='ready')return;receivePhase='tasted';$('receive-sip').hidden=true;sound('sip');$('receive-bar').classList.add('sip-tasting');
    const reading=C.renderToast(state.drink);$('receive-name').textContent=reading.name;$('receive-toast').textContent=reading.toast;reveal('receive-reading',{scroll:true,focus:true});
    $('receive-instruction').textContent='Take your time. There’s something left at the bottom.';
    announce(`${reading.name}. ${reading.toast}`);
  }
  async function lastSip(){
    if(receivePhase!=='tasted')return;receivePhase='last';document.body.dataset.receivePhase='last';$('last-sip').hidden=true;$('receive-reading').hidden=true;$('receive-ingredients').hidden=true;
    const bottom=find(C.bottoms,state.drink.bottom);$('bottom-line').textContent=bottom.line||bottom.name||bottom.text;
    $('bottom-signature').textContent=state.drink.from?'— '+state.drink.from:'';
    $('receive-glass').innerHTML=G.render({...state.drink,ingredients:[]},{reveal:false});$('receive-glass').classList.add('sip-empty');reveal('bottom-reveal',{scroll:true,focus:true});
    renderSound();announce($('bottom-line').textContent+(state.drink.from?' — '+state.drink.from:''));
    // Give the chosen words eight visible seconds. Returning to a background tab
    // must not skip this moment, and revealing actions must not steal focus.
    const token=state.epoch;
    if(!await X.visiblePause(8000,()=>receivePhase==='last'&&state.epoch===token))return;
    reveal('afterglow-actions');document.body.dataset.afterglow='ready';
    if(state.previous){
      $('round-glasses').innerHTML=[state.previous,state.drink].map(d=>`<div>${G.renderMini(d)}<span>${esc(d.from||'One of you')}</span></div>`).join('');$('round-line').textContent=C.commonRoundLine(state.previous,state.drink);reveal('round');
    }
  }
  function pourBack(){
    const first=state.drink.ingredients[0].id;
    const reply={...defaultDrink(),ingredients:[{id:first,parts:1}],from:state.drink.to,to:state.drink.from};
    location.assign(P.buildLink(reply,{base:location.origin+'/pour/',previous:state.drink}));
  }
  async function returnEmpty(){
    const name=state.drink.to||'Someone',to=state.drink.from?state.drink.from+', ':'';
    const message=`${to}I finished the Soul Sip you left for me. Here’s your glass.\n— ${name}`;
    const url=P.buildLink(state.drink,{base:location.origin+'/drink/'+state.drink.glass+'/',meta:{pouredAt:Math.floor(Date.now()/60000),kind:'empty-return'}});
    $('return-link').value=message+'\n\n'+url;reveal('return-link-panel');
    if(navigator.share){try{await navigator.share({title:`${name} left you the empty glass.`,text:message,url});announce('Your empty-glass reply is shared.');return;}catch(error){if(error.name==='AbortError'){announce('Your empty glass is still here.');return;}}}
    announce('Copy this reply and send it back when you fancy.');
  }
  async function copyReturn(){try{await navigator.clipboard.writeText($('return-link').value);$('copy-return').textContent='Reply copied ✓';announce('Empty-glass reply copied.');}catch{$('return-link').focus();$('return-link').select();announce('Select and copy your empty-glass reply.');}}
  function anotherRound(){
    const drink={...defaultDrink(),ingredients:[{id:state.drink.ingredients[0].id,parts:1}],from:state.drink.from,to:state.drink.to};
    location.assign(P.buildLink(drink,{base:location.origin+'/pour/'}));
  }
  async function saveSealed(){
    if(!invitation())return;const button=$('save-sealed');button.disabled=true;
    try{await X.saveSealed(state.drink);announce('The sealed-glass picture is ready to save. Send their invitation alongside it.');}
    catch{announce('The picture could not be saved here. You can still send their invitation.');}
    finally{button.disabled=false;}
  }
  function drawWrapped(ctx,text,x,y,width,lineHeight,maxLines=9){
    const words=String(text).split(/\s+/);let line='',row=0;
    for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y+row*lineHeight);line=word;row++;if(row>=maxLines)return y+row*lineHeight;}else line=next;}
    if(line)ctx.fillText(line,x,y+row*lineHeight);return y+(row+1)*lineHeight;
  }
  function cardWords(ctx,text,width){
    const lines=[];let line='';
    for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines;
  }
  function atlasCell(image,sprite){
    const cell=document.createElement('canvas');cell.width=sprite.w;cell.height=sprite.h;const cx=cell.getContext('2d');cx.drawImage(image,sprite.x,sprite.y,sprite.w,sprite.h,0,0,sprite.w,sprite.h);cx.globalCompositeOperation='destination-in';
    for(const horizontal of [true,false]){const grad=cx.createLinearGradient(0,0,horizontal?sprite.w:0,horizontal?0:sprite.h);grad.addColorStop(0,'transparent');grad.addColorStop(.08,'#000');grad.addColorStop(.92,'#000');grad.addColorStop(1,'transparent');cx.fillStyle=grad;cx.fillRect(0,0,sprite.w,sprite.h);}return cell;
  }
  async function saveCard(){
    const button=$('save-card');button.disabled=true;const include=$('include-last-line').checked;
    try{
      const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');
      const gradient=ctx.createLinearGradient(0,0,1080,1350);gradient.addColorStop(0,'#182239');gradient.addColorStop(.5,'#0a1120');gradient.addColorStop(1,'#20182c');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1350);
      ctx.strokeStyle='#d5b78166';ctx.lineWidth=2;ctx.strokeRect(40,40,1000,1270);ctx.textAlign='center';ctx.fillStyle='#d5b781';ctx.font='17px sans-serif';ctx.fillText('THE SANCTUARY BAR · SILVER CLOUDS',540,92);
      const raw=G.svg(state.drink,{art:false}),blob=new Blob([raw],{type:'image/svg+xml'}),src=URL.createObjectURL(blob);let glass;
      try{glass=new Image();glass.src=src;await glass.decode();ctx.drawImage(glass,330,125,420,630);}finally{URL.revokeObjectURL(src);}
      const vesselArt=new Image();vesselArt.src=G.artPath(state.drink.glass);await vesselArt.decode();ctx.drawImage(vesselArt,330,335,420,420);
      const fs=state.drink.ingredients.map(i=>item(i.id));
      for(let n=0;n<fs.length;n++){const sprite=G.spriteFor(fs[n].id);if(sprite){const image=new Image();image.src=sprite.src;try{await image.decode();ctx.globalAlpha=.9;const width=fs.length>1?270:320,x=fs.length>1?(n?535:275):380;if(sprite.w){ctx.drawImage(atlasCell(image,sprite),x,145,width,width);}else ctx.drawImage(image,x,120,width,350);}catch{/* Words remain a full card if artwork is unavailable. */}finally{ctx.globalAlpha=1;}}else{ctx.fillStyle=fs[n].color;ctx.font='italic 30px Georgia';drawWrapped(ctx,fs[n].name,540,190+n*70,590,38,2);}}
      const reading=C.renderToast(state.drink),bottom=find(C.bottoms,state.drink.bottom);
      const blocks=[{text:reading.name,size:49,family:'Georgia',color:'#efddbb',gap:12},{text:state.drink.ingredients.map(i=>`${i.parts} ${item(i.id).name}`).join(' · '),size:22,family:'sans-serif',color:'#b7c4d8',gap:20},{text:reading.toast,size:26,family:'Georgia',color:'#e3dcd2',gap:22}];
      if(include)blocks.push({text:bottom.line||bottom.name||bottom.text,size:31,family:'Georgia',italic:true,color:'#efd5a8',gap:0});
      let scale=1,layout;
      do{layout=blocks.map(b=>{const size=b.size*scale;ctx.font=`${b.italic?'italic ':''}${size}px ${b.family}`;return {...b,size,lines:cardWords(ctx,b.text,880),height:size*1.35};});if(layout.reduce((n,b)=>n+b.lines.length*b.height+b.gap,0)<=390)break;scale-=.04;}while(scale>.6);
      let y=790;
      for(const b of layout){ctx.fillStyle=b.color;ctx.font=`${b.italic?'italic ':''}${b.size}px ${b.family}`;for(const line of b.lines){ctx.fillText(line,540,y);y+=b.height;}y+=b.gap;}
      ctx.fillStyle='#b6a58b';ctx.font='22px Georgia';ctx.fillText(state.drink.from&&state.drink.to?`From ${state.drink.from}, for ${state.drink.to}`:state.drink.from?`From ${state.drink.from}`:'A feeling. A thought. A little closer.',540,1238);
      ctx.fillStyle='#788ba8';ctx.font='17px sans-serif';ctx.fillText('♪ '+(track().title||track().name),540,1280);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('card');
      const url=URL.createObjectURL(png),link=document.createElement('a');link.href=url;link.download='Sanctuary-a-drink-for-you.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      announce(include?'Card saved with the last line included.':'Card saved. The last line stays between you and the glass.');
    }catch{announce('The card could not be saved in this browser. Your drink is still here.');}finally{button.disabled=false;}
  }
  document.addEventListener('click',event=>{
    const more=event.target.closest('[data-more-jokes]');if(more){state.moreJokes=!state.moreJokes;for(const b of document.querySelectorAll('[data-extra-joke]'))b.hidden=!state.moreJokes;more.setAttribute('aria-expanded',String(state.moreJokes));more.textContent=state.moreJokes?'The familiar shelf ↑':'More private jokes ↓';}
    const bottle=event.target.closest('[data-bottle]');if(bottle){state.selected=bottle.dataset.bottle;renderComposer();}
    const suggestion=event.target.closest('[data-suggestion]');if(suggestion){const s=find(C.suggestions,suggestion.dataset.suggestion);Object.assign(state.drink,clone(s.recipe));state.selected=state.drink.ingredients[0].id;changeRecipe();buildChoices();renderComposer();if(state.playing)setTrack();announce(s.description);if(matchMedia('(max-width:740px)').matches)$('mix-stage').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});}
    const glass=event.target.closest('[data-glass]');if(glass){state.drink.glass=glass.dataset.glass;invalidateLink();renderComposer();}
    const seasoning=event.target.closest('[data-seasoning]');if(seasoning){state.drink.seasoning=seasoning.dataset.seasoning;invalidateLink();renderComposer();}
    const bottom=event.target.closest('[data-bottom]');if(bottom){state.drink.bottom=bottom.dataset.bottom;invalidateLink();renderComposer();}
    const remove=event.target.closest('[data-remove]');if(remove&&!state.busy){const row=state.drink.ingredients.find(i=>i.id===remove.dataset.remove);row.parts--;state.drink.ingredients=state.drink.ingredients.filter(i=>i.parts>0);changeRecipe();renderComposer();}
  });
  $('take-seat').addEventListener('click',seat);$('pour-button').addEventListener('click',()=>pour());$('stir-button').addEventListener('click',()=>stir());$('layer-button').addEventListener('click',()=>stir(true));$('sip-button').addEventListener('click',sip);
  document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();$('main').focus();});
  window.addEventListener('hashchange',()=>{if(location.hash!==''&&location.hash!=='#main')location.reload();});
  $('empty-button').addEventListener('click',()=>{state.drink.ingredients=[];changeRecipe();$('mix-stage').classList.remove('sip-pouring','sip-stirring','sip-tasting');renderComposer();announce('An empty glass. A fresh start.');});
  $('pour-for-someone').addEventListener('click',event=>{$('from-name').value=state.drink.from;$('to-name').value=state.drink.to;renderSend();reveal('send-panel',{scroll:true});if(event.detail===0)$('to-name').focus({preventScroll:true});});
  $('keep-mixing').addEventListener('click',()=>{$('mix-reading').hidden=true;$('send-panel').hidden=true;$('shelf-title').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});});
  $('send-form').addEventListener('submit',share);$('copy-link').addEventListener('click',copy);
  $('preview-invitation').addEventListener('click',()=>{const link=invitation();if(link){showLink(link);window.open(link,'_blank','noopener');}});
  for(const id of ['from-name','to-name'])$(id).addEventListener('input',invalidateLink);
  $('leave-unsigned').addEventListener('change',()=>{$('from-name').disabled=$('leave-unsigned').checked;$('from-name').required=!$('leave-unsigned').checked;invalidateLink();});
  $('save-sealed').addEventListener('click',saveSealed);$('empty-return').addEventListener('click',returnEmpty);$('copy-return').addEventListener('click',copyReturn);$('another-round').addEventListener('click',anotherRound);
  $('song').addEventListener('change',()=>{state.drink.track=$('song').value;invalidateLink();renderComposer();if(state.seated)setTrack({play:state.playing});});
  $('sound-toggle').addEventListener('click',()=>{if(state.playing){audio.pause();state.playing=false;renderSound();}else{state.playing=true;setTrack({play:true});}});
  $('last-sound').addEventListener('click',()=>{if(state.playing){audio.pause();state.playing=false;renderSound();}else{state.playing=true;setTrack({play:true});}});
  $('volume').addEventListener('input',()=>{audio.volume=Number($('volume').value)/100;});
  audio.addEventListener('error',()=>{state.playing=false;renderSound();announce('The room is quiet for a moment. Your drink is still complete.');});
  if(embedded)window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='soul-sips:visibility')return;if(event.data.visible===false){audio.pause();state.playing=false;renderSound();}});
    $('feelings-tab').addEventListener('click',()=>setShelf('feelings'));$('regulars-tab').addEventListener('click',()=>setShelf('regulars'));
  for(const kind of ['feelings','regulars'])$(`${kind}-tab`).addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey)return;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setShelf(event.key==='Home'?'feelings':event.key==='End'?'regulars':kind==='feelings'?'regulars':'feelings',{focus:true});}});
  wireCircle($('stir-surface'),()=>stir());wireCircle($('receive-stir-surface'),receiveAwaken);wireBottleDrag();
  $('receive-stir').addEventListener('click',receiveAwaken);$('receive-sip').addEventListener('click',receiveSip);$('last-sip').addEventListener('click',lastSip);$('pour-back').addEventListener('click',pourBack);$('save-card').addEventListener('click',saveCard);
  initialise();
})();

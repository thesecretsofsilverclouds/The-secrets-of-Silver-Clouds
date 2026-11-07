/* Optional Soul Sip light. Public DOM geometry only; no names, recipe fragments, tracking or storage.
   One shared WebGL2 context serves the visible glasses. Static masks are rebuilt only when needed. */
(() => {
  'use strict';
  const geometry = window.SoulSipMagicGeometry, source = window.SoulSipDrinkShaderSource;
  if (!geometry || !source || window.SoulSipMagicMounted) return;
  window.SoulSipMagicMounted = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Map(), owners = new Map();
  const durations = {pour:1.35,stir:1.6,sip:2.5,reveal:2.4,seal:2.4,arrival:2.8,unseal:2.1,send:2.2};
  const clamp = x => Math.max(0,Math.min(1,x));
  const selectors = '#mix-glass .sip-glass,#receive-glass .sip-glass,#arrival-glass .sip-glass,#send-glass .sip-glass,.ss-stage';
  let renderer = null, attempted = false, raf = 0, scanFrame = 0, hiddenByParent = false, away = false;
  let activeTime = 0, lastTime = null, lastDraw = 0;
  const inFrame = window.parent !== window;
  function ownerFor(target) {
    return target.closest('#mix-stage,#receive-bar,#send-panel,#arrival,.ss-widget') || target;
  }
  function ownerState(owner) {
    if (!owners.has(owner)) owners.set(owner,{effects:new Map(),flags:new Set(),phase:'',sealed:null});
    return owners.get(owner);
  }
  function kick(owner,kind) {ownerState(owner).effects.set(kind,performance.now()/1000);}
  function visible(target) {
    // Glass illustrations themselves are correctly aria-hidden; that is not visual hiding.
    if(document.hidden||away||hiddenByParent||target.closest('[hidden],[inert]'))return false;
    const box=target.getBoundingClientRect();
    return box.width>1&&box.height>1&&box.bottom>0&&box.right>0&&box.top<innerHeight&&box.left<innerWidth&&getComputedStyle(target).visibility!=='hidden';
  }
  function calm(target) {return reduced.matches || Boolean(target.closest('.ss-motion-off'));}
  function updateOwner(owner,target) {
    const state=ownerState(owner),now=performance.now()/1000;
    const shell=target.closest('#send-glass,#receive-glass');
    const flags=new Set([...owner.classList,...(shell?.classList||[])]);
    if(target.classList.contains('sip-awake'))flags.add('spirit-awake');
    const triggers=[['sip-pouring','pour'],['ss-pouring','pour'],['sip-stirring','stir'],['ss-stirring','stir'],['sip-tasting','sip'],['ss-sipping','sip'],['slid-away','send'],['arriving','arrival'],['seal-broken','unseal'],['spirit-awake','reveal']];
    for(const [flag,event] of triggers)if(flags.has(flag)&&!state.flags.has(flag))state.effects.set(event,now);
    const phase=owner.dataset.phase||document.body.dataset.receivePhase||'';
    if(phase==='ready'&&state.phase==='stirring')state.effects.set('reveal',now);
    if(phase==='open'&&state.phase==='opening')state.effects.set('unseal',now);
    const sealed=Boolean(target.closest('.sealed-glass'));
    if(sealed&&state.sealed===null){state.effects.set(owner.id==='send-panel'?'seal':'arrival',now);}
    state.flags=flags;state.phase=phase;state.sealed=sealed;
  }
  function envelope(state,kind,now,still) {
    const start=state.effects.get(kind);if(start===undefined)return 0;
    const p=(now-start)/durations[kind];
    if(p<0||p>=1){state.effects.delete(kind);return 0;}
    return still ? .40 : Math.pow(Math.sin(p*Math.PI),.65);
  }
  function makeRenderer() {
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if(!gl)return null;
    let lost=false;
    const textures=new Map();
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;stop(true);for(const r of records.values())r.target.classList.remove('sip-magic-ready');});
    function compile(type,text) {
      const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(reason);}
      return shader;
    }
    try {
      const vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}') ;
      const fragment=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform sampler2D iChannel0;uniform sampler2D iChannel1;out vec4 outColor;\n'+source+'\nvoid main(){mainImage(outColor,gl_FragCoord.xy);}') ;
      const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      const array=gl.createVertexArray();gl.bindVertexArray(array);gl.useProgram(program);
      const stateTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,stateTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,8,1,0,gl.RGBA,gl.FLOAT,new Float32Array(32));
      for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.NEAREST);
      for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program,'iChannel0'),0);gl.uniform1i(gl.getUniformLocation(program,'iChannel1'),1);
      const resolution=gl.getUniformLocation(program,'iResolution'),clock=gl.getUniformLocation(program,'iTime');
      return {
        get failed(){return lost;},
        remove(record){const t=textures.get(record);if(t){gl.deleteTexture(t.texture);textures.delete(record);}},
        draw(record,values,time){
          if(lost)return false;
          const {width,height,model}=record;
          if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
          gl.useProgram(program);gl.bindVertexArray(array);gl.viewport(0,0,width,height);
          let entry=textures.get(record);
          if(!entry){entry={texture:gl.createTexture(),version:-1};textures.set(record,entry);}
          gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.texture);
          if(entry.version!==record.version){
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,model.maskCanvas);
            for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
            for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
            entry.version=record.version;
          }
          gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,stateTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,8,1,gl.RGBA,gl.FLOAT,values);
          gl.uniform3f(resolution,width,height,1);gl.uniform1f(clock,time);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
          record.ctx.clearRect(0,0,width,height);record.ctx.drawImage(canvas,0,0);
          record.canvas.hidden=false;record.canvas.dataset.renderer='webgl2';if(!record.target.classList.contains('sip-magic-ready'))record.target.classList.add('sip-magic-ready');return true;
        }
      };
    }catch(error){console.warn('Soul Sip light keeps the original glass:',error.message);return null;}
  }
  function measure(record) {
    const box=record.target.getBoundingClientRect();
    const scale=Math.min(.95,720/Math.max(box.width,box.height));
    const width=Math.max(1,Math.round(box.width*scale)),height=Math.max(1,Math.round(box.height*scale));
    const model=geometry.measure(record.target,width,height);
    if(!model)return false;
    record.width=width;record.height=height;record.model=model;record.version++;
    if(record.canvas.width!==width)record.canvas.width=width;
    if(record.canvas.height!==height)record.canvas.height=height;
    record.dirty=false;return true;
  }
  function clear(record) {record.canvas.hidden=true;record.ctx.clearRect(0,0,record.canvas.width,record.canvas.height);}
  function draw(record,now) {
    if(record.failed){clear(record);return false;}
    if(!visible(record.target)){clear(record);return false;}
    if(record.dirty){
      try {if(!measure(record)){clear(record);return false;}}
      catch(error){record.failed=true;clear(record);renderer?.remove(record);record.target.classList.remove('sip-magic-ready');console.warn('Soul Sip light keeps the original glass:',error.message);return false;}
    }
    if(!record.model)return false;
    if(!attempted){attempted=true;renderer=makeRenderer();}
    if(!renderer){clear(record);return false;}
    const still=calm(record.target),model=record.model,state=ownerState(record.owner),values=new Float32Array(32);
    const sealed=Boolean(record.target.closest('.sealed-glass'));
    const f=kind=>envelope(state,kind,now,still);
    values.set([model.fill,f('pour'),f('stir'),f('sip')],0);
    values.set([f('reveal'),sealed?f('seal'):0,f('arrival'),still?1:0],4);
    values.set([...model.colorA,model.index||0],8);values.set([...model.colorB,model.fill],12);
    values.set(model.rim,16);values.set(model.glassBox,20);
    values.set([sealed?0:f('unseal'),f('send'),sealed?1:0,1],24);values.set([1/record.width,1/record.height,0,0],28);
    try{return renderer.draw(record,values,still?0:activeTime);}catch(error){record.failed=true;clear(record);renderer.remove(record);record.target.classList.remove('sip-magic-ready');return false;}
  }
  function runningRecords(){return [...records.values()].filter(record=>visible(record.target));}
  function stop(clearAll=false){if(raf)cancelAnimationFrame(raf);raf=0;lastTime=null;if(clearAll)for(const record of records.values())clear(record);}
  function tick(now) {
    raf=0;const live=runningRecords();
    if(attempted&&(!renderer||renderer.failed)){stop(true);return;}
    if(!live.length){stop(true);return;}
    if(lastTime!==null)activeTime+=Math.min(.12,(now-lastTime)/1000);lastTime=now;
    const active=live.some(record=>[...ownerState(record.owner).effects.values()].some(start=>now/1000-start<3));
    const interval=active?1000/40:1000/24;
    if(now-lastDraw>=interval){for(const record of live)draw(record,now/1000);lastDraw=now;}
    if(live.some(record=>!record.failed&&!calm(record.target)))raf=requestAnimationFrame(tick);else lastTime=null;
  }
  function wake(){
    if(document.hidden||away||hiddenByParent){stop(true);return;}
    const live=runningRecords();
    for(const record of records.values())if(!live.includes(record))clear(record);
    for(const record of live)draw(record,performance.now()/1000);
    if(renderer&&!renderer.failed&&live.some(record=>!record.failed&&!calm(record.target))&&!raf)raf=requestAnimationFrame(tick);
  }
  function scan(){
    scanFrame=0;
    const targets=new Set(document.querySelectorAll(selectors));
    for(const [target,record]of records)if(!targets.has(target)||!target.isConnected){intersection?.unobserve(target);renderer?.remove(record);record.canvas.remove();records.delete(target);}
    for(const target of targets){
      let record=records.get(target);
      if(!record){
        const canvas=document.createElement('canvas');canvas.className='sip-magic-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
        const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)continue;
        record={target,canvas,ctx,owner:ownerFor(target),dirty:true,version:0,width:1,height:1,model:null};records.set(target,record);target.append(canvas);intersection?.observe(target);
      }
      record.dirty=true;updateOwner(record.owner,target);
    }
    for(const owner of owners.keys())if(!owner.isConnected)owners.delete(owner);
    wake();
  }
  function schedule(){if(!scanFrame)scanFrame=requestAnimationFrame(scan);}
  // Sliding gifts begin outside the viewport. Wake as they cross the edge,
  // rather than waiting for their CSS entrance to finish.
  const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting))schedule();
  },{threshold:0.01}) : null;
  const observer=new MutationObserver(changes=>{
    const relevant=changes.filter(change=>!change.target.matches?.('.sip-magic-canvas')&&
      (change.target===document.body||change.target.closest?.('#mix-stage,#receive-bar,#arrival-glass,#send-panel,.ss-widget')));
    if(relevant.some(change=>change.type==='childList'&&[...change.addedNodes,...change.removedNodes].some(node=>node.nodeType===1&&!node.matches?.('.sip-magic-canvas'))))schedule();
    else if(relevant.some(change=>change.type==='attributes'&&
      (change.attributeName!=='style'||change.target.matches?.('.sip-glass,.ss-widget,.ss-fluid-body,.ss-liquid')))){for(const record of records.values())record.dirty=true;schedule();}
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','inert','aria-hidden','data-phase','data-mode','data-receive-phase','aria-valuenow']});
  document.addEventListener('ss:bar-sound',event=>{const owner=event.target.closest?.('.ss-widget');if(owner){const kind={pour:'pour',stir:'stir',ready:'reveal',taste:'sip'}[event.detail?.kind];if(kind)kick(owner,kind);schedule();}});
  document.addEventListener('soul-sip-magic:geometry',schedule);
  document.addEventListener('animationend',event=>{if(event.target.closest?.('#receive-glass,#send-glass'))schedule();});
  document.addEventListener('transitionend',event=>{if(event.target.matches?.('.ss-fluid-body,.sip-spirit-cloud'))schedule();});
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('scroll',wake,{passive:true,capture:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pagehide',()=>{away=true;stop(true);});window.addEventListener('pageshow',()=>{away=false;schedule();});
  reduced.addEventListener('change',()=>{stop();wake();});
  window.addEventListener('message',event=>{
    if(!inFrame||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='soul-sips:visibility'||typeof event.data.visible!=='boolean')return;
    hiddenByParent=!event.data.visible;wake();
  });
  if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(document.body);
  scan();
})();

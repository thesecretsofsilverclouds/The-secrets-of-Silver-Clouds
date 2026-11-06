/* Optional local-only Soul Sips effects. Reads the mixer; never changes its state. */
(() => {
  'use strict';
  const boot = () => document.querySelectorAll('.ss-widget').forEach(mount);

  function mount(host) {
    const stage = host.querySelector('.ss-stage');
    if (!stage || stage.querySelector('.ss-vfx-canvas')) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {alpha:true});
    if (!ctx) return;
    canvas.className = 'ss-vfx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    stage.append(canvas);
    host.classList.add('ss-vfx-enhanced');

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, dpr = 1, raf = 0;
    let effects = [], colors, geometry, destroyed = false, pageAway = false;
    let onScreen = inViewport();
    let panelHidden = hiddenPanel();
    const compact = () => width < 440;
    const allowed = () => !reduced.matches && !host.classList.contains('ss-motion-off');
    const running = () => allowed() && onScreen && !panelHidden && host.dataset.mode!=='melters' && !pageAway && !document.hidden;
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
    const ease = t => 1 - (1 - clamp(t)) ** 3;
    const setClass = (name, enabled) => {
      if (host.classList.contains(name) !== enabled) host.classList.toggle(name, enabled);
    };

    function inViewport() {
      const r = stage.getBoundingClientRect();
      return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    }
    function hiddenPanel() {
      return !!stage.closest('[hidden], [inert], [aria-hidden="true"]') ||
        !stage.getClientRects().length || getComputedStyle(stage).visibility === 'hidden';
    }
    function color(value, fallback) {
      const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
      if (hex) {
        const s = hex[1].length === 3 ? [...hex[1]].map(c => c+c).join('') : hex[1];
        return [0,2,4].map(i => parseInt(s.slice(i,i+2),16));
      }
      const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
      return rgb ? rgb.slice(1,4).map(Number) : fallback;
    }
    function measure() {
      const rect = stage.getBoundingClientRect();
      const liquid = host.querySelector('.ss-liquid');
      const cup = liquid?.getBoundingClientRect();
      const fill = clamp(Number(host.querySelector('.ss-fill-track')?.getAttribute('aria-valuenow') || 0) / 100);
      const top = cup ? cup.top-rect.top : height*.551;
      const cupHeight = cup?.height || height*.28;
      geometry = {
        x:cup ? cup.left-rect.left+cup.width/2 : width*.5,
        rim:top,
        surface:top+cupHeight*(.025+.95*(1-fill)),
        cupWidth:cup?.width || width*.3,
        base:top+cupHeight+height*.007
      };
    }
    function palette() {
      const style = getComputedStyle(host);
      const accent = color(style.getPropertyValue('--ss-accent'), [114,182,255]);
      colors = {
        accent,
        second:color(style.getPropertyValue('--ss-second'), accent),
        pour:color(style.getPropertyValue('--ss-pour-color'), accent)
      };
    }
    function resize() {
      const rect = stage.getBoundingClientRect();
      width = rect.width; height = rect.height;
      dpr = Math.min(devicePixelRatio || 1, compact() ? 1.5 : 2);
      const pixelsWide = Math.max(1, Math.round(width*dpr));
      const pixelsHigh = Math.max(1, Math.round(height*dpr));
      // Mobile browser chrome can resize the viewport without resizing the glass.
      // Reassigning either dimension discards the current canvas frame.
      if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
      if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      measure();
      if (running() && effects.length) requestFrame();
    }
    function wipe() {
      ctx.clearRect(0,0,width,height);
    }
    function stop(clearEffects = false) {
      cancelAnimationFrame(raf); raf = 0;
      wipe();
      if (clearEffects) {
        effects = [];
        setClass('ss-vfx-emerging',false);setClass('ss-vfx-paused',false);
        clearSip();
      }
    }
    function clearSip() {
      setClass('ss-vfx-tasting',false);
    }
    function prepareSip() {
      clearSip();setClass('ss-vfx-emerging',false);
      void stage.offsetWidth;
      setClass('ss-vfx-tasting',true);
    }
    function add(type, duration) {
      if (!running() || host.dataset.phase === 'empty') return;
      if(type==='sip') {effects=[];prepareSip();}
      effects = effects.filter(effect => effect.type !== type);
      effects.push({type, duration, start:performance.now(), colors:{...colors}, blend:host.classList.contains('ss-has-blend')});
      // At most one short animation per action, including fast repeat taps.
      if (type === 'emerge') {
        setClass('ss-vfx-emerging',false);
        void stage.offsetWidth;
        setClass('ss-vfx-emerging',true);
      }
      requestFrame();
    }
    function requestFrame() {
      if (!raf && effects.length && width && height && running()) raf = requestAnimationFrame(frame);
    }
    function visibility() {
      panelHidden=hiddenPanel();
      if(!running()) {stop(true);return;}
      const now = performance.now();
      // Wall-clock expiry prevents an old pour replaying after a hidden tab returns.
      effects = effects.filter(effect => now-effect.start < effect.duration);
      if (!effects.some(effect => effect.type === 'emerge')) setClass('ss-vfx-emerging',false);
      if (!effects.some(effect => effect.type === 'sip')) clearSip();
      requestFrame();
    }

    function stroke(points, c, alpha, lineWidth, glow = 0) {
      if (!points.length || alpha <= 0) return;
      ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
      for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
      ctx.strokeStyle = rgba(c,alpha); ctx.lineWidth = lineWidth;
      ctx.shadowColor = rgba(c,alpha*.7); ctx.shadowBlur = glow;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    function ring(x,y,rx,ry,c,alpha,from = 0,to = Math.PI*2) {
      if (alpha <= 0) return;
      ctx.beginPath(); ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,from,to);
      ctx.strokeStyle = rgba(c,alpha); ctx.lineWidth = Math.max(.7,width*.0018);
      ctx.shadowColor = rgba(c,alpha); ctx.shadowBlur = 5;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    function bloom(x,y,r,c,alpha) {
      if (alpha <= 0) return;
      const light = ctx.createRadialGradient(x,y,0,x,y,Math.max(1,r));
      light.addColorStop(0,rgba(c,alpha));
      light.addColorStop(.32,rgba(c,alpha*.38));
      light.addColorStop(1,rgba(c,0));
      ctx.fillStyle = light; ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    function pour(effect,t) {
      const g = geometry, c = effect.colors.pour;
      const alpha = clamp(t/.12)*clamp((1-t)/.21);
      const start = height*.46, length = Math.max(height*.055,g.surface-start);
      const growth = ease(t/.24);
      const ribbons = compact() ? 2 : 3;
      for (let k=0;k<ribbons;k++) {
        const points=[];
        for (let i=0;i<=22;i++) {
          const q=i/22*growth;
          points.push({x:g.x+Math.sin(q*9-t*13+k*2.1)*width*.0045+(k-(ribbons-1)/2)*width*.003,y:start+length*q});
        }
        stroke(points,c,alpha*(k ? .33 : .7),Math.max(.9,width*(k ? .0016 : .003)),width*.012);
      }
      const count = compact() ? 3 : 5;
      if (t>.08 && t<.88) for (let i=0;i<count;i++) {
        const q=(t*2.15+i/count)%1;
        const x=g.x+Math.sin(i*2.7+t*8)*width*.008;
        const y=start+length*q;
        ctx.fillStyle=rgba(c,alpha*(.32+.32*q));
        ctx.beginPath();ctx.ellipse(x,y,Math.max(.8,width*.002),Math.max(1.5,height*.0024),0,0,Math.PI*2);ctx.fill();
      }
      bloom(g.x,g.surface,width*.045,c,alpha*.17);
      ring(g.x,g.surface+height*.002,g.cupWidth*(.13+.22*((t*2)%1)),height*.005,c,alpha*.25);
    }
    function stir(effect,t) {
      const g=geometry, spin=t*Math.PI*4.5;
      const alpha=Math.sin(Math.PI*t)**.7;
      const centerY=g.surface+height*.009;
      for (let i=0;i<3;i++) {
        const c=i%2?effect.colors.second:effect.colors.accent;
        const rx=g.cupWidth*(.23+i*.08), ry=height*(.006+i*.004);
        ring(g.x,centerY+i*height*.006,rx,ry,c,alpha*(.48-i*.09),spin+i*2,spin+i*2+Math.PI*1.6);
      }
      // A single low-opacity helix stays inside the liquid; no cloud over the faces.
      const points=[];
      const depth=Math.max(height*.025,g.base-g.surface-height*.02);
      for (let i=0;i<=30;i++) {
        const q=i/30;
        points.push({x:g.x+Math.sin(q*9-spin)*g.cupWidth*.31*(1-q*.3),y:g.surface+q*depth});
      }
      stroke(points,effect.colors.second,alpha*.16,Math.max(.8,width*.002),4);
      bloom(g.x,centerY,width*.075,effect.colors.accent,alpha*.1);
    }
    function emergence(effect,t) {
      const g=geometry;
      const count=effect.blend?2:1;
      for (let side=0;side<count;side++) {
        const local=clamp((t-(side ? .12 : 0))/.83);
        if (!local || local>=1) continue;
        const c=side?effect.colors.second:effect.colors.accent;
        const target=width*(effect.blend ? (side ? .65 : .35) : .5);
        const direction=side?1:-1;
        const travel=ease(local/.64);
        const tail=Math.max(0,travel-.42);
        const strength=Math.sin(Math.PI*local)*.65;
        const points=[];
        for (let i=0;i<=26;i++) {
          const q=tail+(travel-tail)*i/26;
          points.push({x:g.x+(target-g.x)*q+Math.sin(q*Math.PI*2)*width*.04*direction,y:g.rim+height*.015-q*height*.37});
        }
        stroke(points,c,strength*.52,Math.max(1,width*.003),width*.014);
        const head=points[points.length-1];
        bloom(head.x,head.y,width*(.065+.04*local),c,strength*.18);
        // An opening elliptical halo stays below the portrait's facial features.
        const pulse=clamp(local/.43);
        ring(g.x+(target-g.x)*.45,g.rim-height*.045,width*(.05+.1*pulse),height*(.008+.01*pulse),c,strength*.24);
      }
    }
    function sip(effect,t) {
      const g=geometry, first=effect.colors.accent, second=effect.colors.second;
      const envelope=Math.sin(Math.PI*t)**1.15;
      const travel=ease(t/.8);
      const x=g.x, y=g.surface+(height*.43-g.surface)*ease(t/.58);
      const radius=width*(.035+.72*travel);
      const ratio=.3+.47*ease(t/.6);

      // One coherent lens opens from the drink, envelops the portrait, then fades.
      // Smooth gradients and broad spacing keep the image calm and legible.
      ctx.save();ctx.translate(x,y);ctx.scale(1,ratio);
      const lens=ctx.createRadialGradient(0,0,0,0,0,radius);
      lens.addColorStop(0,rgba(first,envelope*.075));
      lens.addColorStop(.58,rgba(first,envelope*.1));
      lens.addColorStop(.82,rgba(second,envelope*.23));
      lens.addColorStop(.94,rgba(first,envelope*.43));
      lens.addColorStop(1,rgba(first,0));
      ctx.fillStyle=lens;ctx.beginPath();ctx.ellipse(0,0,radius,radius,0,0,Math.PI*2);ctx.fill();
      ctx.restore();

      const edge=ctx.createLinearGradient(x-radius,y,x+radius,y);
      edge.addColorStop(0,rgba(first,envelope*.85));
      edge.addColorStop(.48,rgba(first,envelope*.31));
      edge.addColorStop(1,rgba(second,envelope*.85));
      ctx.beginPath();ctx.ellipse(x,y,radius*.93,radius*ratio*.93,0,0,Math.PI*2);
      ctx.strokeStyle=edge;ctx.lineWidth=Math.max(.8,width*.0023);
      ctx.shadowColor=rgba(first,envelope*.55);ctx.shadowBlur=width*.022;ctx.stroke();ctx.shadowBlur=0;

      // Two or three wide depth arcs, not a particle field or a busy tunnel.
      const count=compact()?2:3;
      for(let i=0;i<count;i++) {
        const q=clamp((t-i*.075)/(.87-i*.035));
        const a=Math.sin(Math.PI*q)*envelope;
        const r=radius*(.54+i*.14);
        const turn=i*Math.PI*.7+t*.55;
        ring(x,y,r,r*ratio,i%2?second:first,a*.34,turn,turn+Math.PI*1.12);
      }
      bloom(x,g.rim-height*.015,width*(.07+.15*travel),first,envelope*.27*(1-t));
      bloom(width*.25,height*.39,width*.42,first,envelope*.13);
      if(effect.blend)bloom(width*.77,height*.44,width*.38,second,envelope*.13);
      // A single quiet reflection anchors the larger sensation to the counter.
      ring(g.x,g.base,width*(.11+.28*travel),height*(.012+.024*travel),first,envelope*.13*(1-t));
    }
    function frame(now) {
      raf=0;
      if (!host.isConnected) {destroy();return;}
      if (!running() || host.dataset.phase==='empty') {stop(true);return;}
      effects=effects.filter(effect=>now-effect.start<effect.duration);
      wipe();
      ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';ctx.lineJoin='round';
      for (const effect of effects) {
        const t=clamp((now-effect.start)/effect.duration);
        if (effect.type==='pour') pour(effect,t);
        else if (effect.type==='stir') stir(effect,t);
        else if (effect.type==='emerge') emergence(effect,t);
        else if (effect.type==='sip') sip(effect,t);
      }
      ctx.restore();
      if (!effects.some(effect=>effect.type==='emerge')) setClass('ss-vfx-emerging',false);
      if (!effects.some(effect=>effect.type==='sip')) clearSip();
      requestFrame();
    }

    function has(value,name) { return (value||'').split(/\s+/).includes(name); }
    function started(records,name) {
      const changes=records.filter(record=>record.attributeName==='class');
      return changes.some((record,index)=>{
        const next=index+1<changes.length?changes[index+1].oldValue:host.getAttribute('class');
        return !has(record.oldValue,name)&&has(next,name);
      });
    }
    function sync(records=[],initial=false) {
      if (!host.isConnected) {destroy();return;}
      panelHidden=hiddenPanel();
      if (!allowed() || panelHidden || host.dataset.mode==='melters' || host.dataset.phase==='empty') {stop(true);return;}
      palette();measure();
      if (started(records,'ss-pouring') || initial&&host.classList.contains('ss-pouring')) {
        effects=effects.filter(effect=>effect.type!=='sip');clearSip();
        effects=effects.filter(effect=>effect.type!=='stir'&&effect.type!=='emerge');
        setClass('ss-vfx-emerging',false);add('pour',1100);
      }
      if (started(records,'ss-stirring') || initial&&host.classList.contains('ss-stirring')) {
        effects=effects.filter(effect=>effect.type!=='sip');clearSip();
        effects=effects.filter(effect=>effect.type!=='pour'&&effect.type!=='emerge');
        setClass('ss-vfx-emerging',false);add('stir',1500);
      }
      if (records.some(record=>record.attributeName==='data-phase'&&record.oldValue==='stirring')&&host.dataset.phase==='ready') {
        effects=effects.filter(effect=>effect.type!=='stir');add('emerge',1850);
      }
      if (started(records,'ss-sipping')) add('sip',3400);
      visibility();
    }
    const observer=new MutationObserver(records=>sync(records));
    observer.observe(host,{attributes:true,attributeOldValue:true,attributeFilter:['class','data-phase','data-mode','style','hidden','inert','aria-hidden']});
    const ancestors=new MutationObserver(()=>{
      const hidden=hiddenPanel();
      if(hidden!==panelHidden) {
        panelHidden=hidden;
        if(hidden)stop(true);else {resize();onScreen=inViewport();visibility();}
      }
    });
    // Tab panels can be ancestors of the console rather than the widget itself.
    // Observe only their attributes; text, images and controls remain untouched.
    for(let parent=stage.parentElement;parent;parent=parent.parentElement) {
      if(parent!==host)ancestors.observe(parent,{attributes:true,attributeFilter:['hidden','inert','aria-hidden','class','style']});
    }
    const resizer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
    resizer?.observe(stage);
    const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      onScreen=entries[entries.length-1].isIntersecting;visibility();
    },{threshold:0}):null;
    intersection?.observe(stage);
    const fallbackScroll=()=>{if(!intersection){onScreen=inViewport();visibility();}};
    const motionChange=()=>{if(!allowed())stop(true);else sync();};
    const pageHide=()=>{pageAway=true;visibility();};
    const pageShow=()=>{pageAway=false;onScreen=inViewport();visibility();};
    const windowResize=()=>{resize();onScreen=inViewport();visibility();};
    reduced.addEventListener('change',motionChange);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('resize',windowResize,{passive:true});
    if(!intersection)window.addEventListener('scroll',fallbackScroll,{passive:true,capture:true});
    window.addEventListener('pagehide',pageHide);
    window.addEventListener('pageshow',pageShow);
    function destroy() {
      if(destroyed)return;destroyed=true;stop(true);
      observer.disconnect();ancestors.disconnect();resizer?.disconnect();intersection?.disconnect();
      reduced.removeEventListener('change',motionChange);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('resize',windowResize);
      window.removeEventListener('scroll',fallbackScroll,true);
      window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);
      canvas.remove();host.classList.remove('ss-vfx-enhanced');
    }
    resize();palette();sync([],true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

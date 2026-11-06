/* Transparent vessels and spirits, with code-drawn liquid and floating names. */
(function(root){
  'use strict';
  let serial=0;
  const shapes={
    'crystal-shot':{path:'M65 222 Q150 237 235 222 L216 405 Q150 429 84 405 Z',rim:[150,222,85,16],bottom:407},
    'misted-glass':{path:'M73 224 Q150 239 227 224 L209 409 Q150 431 91 409 Z',rim:[150,224,77,15],bottom:410},
    'glowing-vial':{path:'M127 205 L173 205 L173 256 Q215 280 205 376 Q203 415 150 419 Q97 415 95 376 Q85 280 127 256 Z',rim:[150,205,23,8],bottom:419},
    'bone-glass':{path:'M77 220 Q150 242 223 220 L207 312 Q200 346 160 350 L160 400 L195 413 Q150 430 105 413 L140 400 L140 350 Q100 346 93 312 Z',rim:[150,220,73,16],bottom:419},
    'celestial-tankard':{path:'M67 228 Q145 244 223 228 L216 399 Q145 429 74 399 Z',rim:[145,228,78,15],bottom:411,handle:true},
    'duskkin-tankard':{path:'M68 225 L84 207 L112 220 L145 205 L179 220 L208 207 L224 225 L210 400 Q146 428 82 400 Z',rim:[146,225,78,15],bottom:414,handle:true}
  };
  const fallback={nostalgia:'#72b6ff',joy:'#ffd16b',love:'#f39ecb',glory:'#ff9d6b',sadness:'#7a9cf5',anger:'#ff617a',homecoming:'#eac18a'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function entries(){const c=root.SoulSipContent;return [...(c?.feelings||[]),...(c?.regulars||[])];}
  function ingredient(id){return entries().find(x=>x.id===id)||{id,name:id,color:fallback[id]||'#bd9be9',spirit:Object.hasOwn(fallback,id)?`/images/soul-sips-mixer/spirit-${id}.webp`:null};}
  function spriteFor(id){const f=ingredient(id);return f.spirit?{src:f.spirit}:root.SoulSipSpiritAtlases?.[id]||null;}
  function spirit(f,i){
    const sprite=spriteFor(f.id);if(!sprite)return `<span class="sip-word sip-word-${i}" style="color:${esc(f.color)}">${esc(f.name)}</span>`;
    if(!sprite.w)return `<img class="sip-spirit sip-spirit-${i}" src="${esc(sprite.src)}" alt="" draggable="false">`;
    const id='spirit-tile-'+(++serial),rect=`x="${sprite.x}" y="${sprite.y}" width="${sprite.w}" height="${sprite.h}"`;
    return `<svg class="sip-spirit sip-spirit-${i} sip-atlas-spirit" viewBox="${sprite.x} ${sprite.y} ${sprite.w} ${sprite.h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${id}-clip"><rect ${rect}/></clipPath><linearGradient id="${id}-h"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}-mh" maskUnits="userSpaceOnUse" ${rect}><rect ${rect} fill="url(#${id}-h)"/></mask><mask id="${id}-mv" maskUnits="userSpaceOnUse" ${rect}><rect ${rect} fill="url(#${id}-v)"/></mask></defs><g clip-path="url(#${id}-clip)" mask="url(#${id}-mh)"><image mask="url(#${id}-mv)" href="${esc(sprite.src)}" width="${sprite.sheetWidth}" height="${sprite.sheetHeight}"/></g></svg>`;
  }
  function palette(drink){return (drink.ingredients?.length?drink.ingredients:[{id:'nostalgia',parts:0}]).map(x=>({...ingredient(x.id),parts:x.parts}));}
  const artShapes={
    'crystal-shot':{path:'M270 225 Q627 320 984 225 L860 920 Q627 970 397 920 Z',top:255,bottom:940,cx:627,rx:340},
    'misted-glass':{path:'M403 114 Q627 150 851 114 C861 405 859 675 830 875 C813 999 798 1085 777 1123 Q627 1152 477 1123 C453 1044 434 962 419 875 C389 674 389 407 403 114 Z',top:143,bottom:1125,cx:627,rx:210},
    'glowing-vial':{path:'M525 165 L730 165 L720 390 C1030 480 1090 950 780 1050 Q627 1115 475 1050 C165 950 220 480 535 390 Z',top:195,bottom:1060,cx:627,rx:325},
    'bone-glass':{path:'M425 115 Q627 160 829 115 C970 385 900 555 627 610 C350 550 310 385 425 115 Z',top:145,bottom:585,cx:627,rx:250},
    'celestial-tankard':{path:'M250 185 Q535 240 826 185 L818 971 Q534 1020 250 971 Z',top:210,bottom:975,cx:535,rx:285},
    'duskkin-tankard':{path:'M238 200 Q510 245 805 200 L800 995 Q520 1040 236 995 Z',top:225,bottom:995,cx:520,rx:280}
  };
  const artPath=glass=>'/friends/assets/vessel-'+(artShapes[glass]?glass:'crystal-shot')+'.webp';
  function svg(drink,{id='sip-'+(++serial),art=true}={}){
    const shape=shapes[drink.glass]||shapes['crystal-shot'];
    const fs=palette(drink),a=fs[0].color,b=fs[1]?.color||a;
    const total=(drink.ingredients||[]).reduce((n,i)=>n+i.parts,0);
    const level=total?Math.max(230,391-total*34):420;
    const split=fs.length>1?Math.round(100*(fs[1].parts/Math.max(total,1))):50;
    const grad=drink.stirred?`<stop stop-color="${esc(b)}"/><stop offset="1" stop-color="${esc(a)}"/>`:`<stop offset="${split}%" stop-color="${esc(b)}"/><stop offset="${Math.min(100,split+.5)}%" stop-color="${esc(a)}"/>`;
    const artShape=artShapes[drink.glass]||artShapes['crystal-shot'];
    const artLevel=artShape.bottom-(artShape.bottom-artShape.top)*Math.min(total/4,.96);
    return `<svg class="sip-vessel" viewBox="0 0 300 450" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}-liquid" x1="0" y1="1" x2="0" y2="0">${grad}</linearGradient><clipPath id="${id}-clip"><path d="${artShape.path}"/></clipPath><radialGradient id="${id}-aura"><stop stop-color="${esc(a)}" stop-opacity=".3"/><stop offset="1" stop-color="${esc(a)}" stop-opacity="0"/></radialGradient></defs><ellipse cx="150" cy="425" rx="125" ry="18" fill="url(#${id}-aura)"/><g transform="translate(0 150) scale(.23923445)"><g clip-path="url(#${id}-clip)">${total?`<rect x="100" y="${artLevel}" width="1050" height="1200" fill="url(#${id}-liquid)" opacity=".9"/><ellipse cx="${artShape.cx}" cy="${artLevel}" rx="${artShape.rx}" ry="27" fill="${esc(b)}" opacity=".8"/><path d="M100 720 Q460 620 700 740 T1150 700 M100 900 Q500 800 1100 915" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="5"/>`:''}</g></g>${art?`<image href="${artPath(drink.glass)}" x="0" y="150" width="300" height="300"/>`:''}</svg>`;
  }

  function render(drink,{mini=false,reveal=false,id,labels=!mini}={}){
    const fs=palette(drink),total=(drink.ingredients||[]).reduce((n,i)=>n+i.parts,0);
    const spiritMarkup=total?fs.map((f,i)=>labels?`<div class="sip-essence sip-essence-${i}" style="--essence-color:${esc(f.color)}"><div class="sip-portrait">${spriteFor(f.id)?spirit(f,i):''}</div><span class="sip-spirit-name">${esc(f.name)}</span></div>`:spirit(f,i)).join(''):'';
    return `<div class="sip-glass ${mini?'sip-mini ':''}${reveal?'sip-awake ':''}${fs.length>1?'sip-pair ':''}sip-${esc(drink.glass||'crystal-shot')}" style="--sip-color:${esc(fs[0].color)};--sip-second:${esc(fs[1]?.color||fs[0].color)}"><div class="sip-halo"></div><div class="sip-spirit-cloud${labels?' sip-labelled':''}">${spiritMarkup}</div>${svg(drink,{id})}<div class="sip-sparkles" aria-hidden="true">✦<i>✧</i><b>·</b></div></div>`;
  }
  root.SoulSipGlass={render,renderMini:(drink,options={})=>render(drink,{...options,mini:true,reveal:true}),svg,palette,escape:esc,shapes,artPath,spriteFor};
})(typeof window!=='undefined'?window:globalThis);

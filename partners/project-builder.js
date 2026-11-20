/* A small, authored project builder. No accounts, uploads or generated lore. */
(() => {
  'use strict';
  const mount = document.getElementById('partner-project-builder');
  const data = window.SCPartnerProjectData;
  if (!mount || !data?.pillars?.length) return;
  const catalog = window.SCPartnerProjectCatalog || {projects:[],crossovers:[]};
  const pilotByFormat = {
    'BSC-30': {animation:'Create one 3–5-minute animated horror scene for adult fantasy audiences.',audio:'Create one 3–5-minute scripted horror audio episode for adult fantasy listeners.'},
    'BSC-32': {audio:'Write and produce one self-contained classified-case audio episode with a twist.',publishing:'Create one self-contained illustrated classified-case dossier with a twist.'},
    'BSC-39': {animation:'Produce a one-minute, motion-led Onari transformation sequence.',game:'Create one choreography-driven movement prototype built around an Onari transformation.'},
    'BSC-44': {audio:'Write one 12-minute audio mystery around a fragment of the Philosopher’s Stone.',game:'Create one single-room relic-discovery game prototype around a fragment of the Philosopher’s Stone.'}
  };
  const extraTitles = {
    mi6:'MI6 case files','the-order':'The Order','max-prison':'Max Prison','fairy-realm':'The Fairy Realm',
    onari:'The Onari','rune-rider':'Rune Riders','new-big-ben':'New Big Ben',worldstream:'Worldstream',
    'celestial-veil':'The Celestial Veil','alchemical-society':'The Alchemical Society',technomagic:'Technomagic'
  };
  const coreIds = new Set(data.pillars.map(p=>p.id));
  const extraPillars = Object.entries(extraTitles).map(([id,title])=>{
    const projects = catalog.projects.filter(p=>p.pillarId===id), first=projects[0];
    if(!first)return null;
    return {id,title,hook:first.hook,audience:'Fantasy and genre audiences; age, tone and presentation to agree for this project.',
      status:first.status,commercialRoute:first.commercialRoute,silentBrings:[title+' setting, associated lore and existing visual assets','The connected Silver Clouds world and creative direction'],
      partnerBrings:[first.partnerBrings],proofLinks:first.sources.map(url=>({label:'Explore '+title,url,kind:'source material'})),
      recommendedFormats:[...new Set(projects.flatMap(p=>p.formats))].map(id=>({id,label:id,commercialRoute:first.commercialRoute,
        pilot:{title:first.title,scope:[pilotByFormat[first.id]?.[id] || first.firstPilot],existing:[first.existing],needed:[first.partnerBrings]}}))};
  }).filter(Boolean);
  const shonenProject=catalog.projects.find(p=>p.id==='BSC-31');
  const pillars = [...data.pillars,...extraPillars].map(p=>p.id==='character-stories' && shonenProject ? {...p,storyOptions:[...p.storyOptions,
    {id:'shonen-kartia',title:shonenProject.title,hook:shonenProject.hook,audience:'Adult fantasy and character-led dramatic audiences.',
      proofLinks:shonenProject.sources.map(url=>({label:'Explore Shonen',url,kind:'lore'})),recommendedFormatIds:shonenProject.formats}]}:p);
  const imageBase = new URL('../images/',document.currentScript.src).href;
  const componentAssets = new URL('./assets/',document.currentScript.src).href;
  const proofHref = url => location.protocol === 'file:' ? new URL(url,'https://thesecretsofsilverclouds.com').href : url;
  const byId = new Map(pillars.map(p => [p.id,p]));
  const crossoverFormats = {'BX-01':['music','animation'],'BX-02':['animation','game'],'BX-03':['audio'],
    'BX-04':['game','audio'],'BX-05':['game','experience'],'BX-06':['experience','publishing'],
    'BX-07':['animation'],'BX-08':['animation'],'BX-09':['game','experience'],'BX-10':['animation'],'BX-11':['game'],'BX-12':['audio']};
  const projects = [...catalog.projects,...catalog.crossovers.map(c=>{
    const base=catalog.projects.find(p=>p.id===c.baseProjectId);
    return {...base,id:c.id,title:c.title,priority:'crossover',formats:crossoverFormats[c.id],formatLabels:[c.formatLabel],
      hook:c.pilot,firstPilot:c.pilot,partnerBrings:c.partnerBrings,validation:c.validation,addPillarId:c.addPillarId,baseProjectId:c.baseProjectId,
      commercialRoute:'Commission or co-produce a focused crossover pilot with an agreed creative and commercial scope.',
      status:'Optional crossover direction · pilot proposed',sources:[...base.sources,...(byId.get(c.addPillarId)?.proofLinks.map(l=>l.url)||[])]};
  })];
  const projectById=new Map(projects.map(p=>[p.id,p]));
  const assets = {
    'core-story': ['hero-cycle/rooftops-768.webp','50% 50%','contain'],
    sanctuary: ['codex-refresh/sanctuary-london.webp','50% 50%','contain'],
    duskkin: ['hero-cycle/zara-768.webp','50% 45%','contain'],
    'demons-legion': ['gallery-refresh/demons-legion-gothic-stage-thumb.webp','50% 42%','contain'],
    'road-sprites-streamliner': ['@road-sprite-crew.webp','50% 50%','contain'],
    lintels: ['codex-refresh/lintel-cloud.webp','50% 52%','contain'],
    'holy-items-guardians': ['guardian-gallery-20260917/greah-hero-thumb.webp','50% 40%','contain'],
    'character-stories': ['hero-cycle/gabriel-768.webp','50% 45%','contain'],
    'infinitys-quill': ['gallery-refresh/infinitys-quill-interior-thumb.webp','50% 50%','cover'],
    wooburn: ['gallery-refresh/wooburn-memory-trees-thumb.webp','51% 43%','cover'],
    mi6:['@mi6.webp','50% 50%','cover'],'the-order':['@the-order.webp','50% 50%','contain'],
    'max-prison':['@max-prison.webp','50% 50%','cover'],'fairy-realm':['@fairy-realm.webp','62% 45%','cover'],
    onari:['@onari.webp','50% 50%','cover'],'rune-rider':['@rune-rider.webp','50% 50%','contain'],
    'new-big-ben':['@new-big-ben.webp','58% 38%','cover'],worldstream:['experience/worldstream-london.webp','50% 50%','cover'],
    'celestial-veil':['experience/worldstream-london.webp','50% 50%','cover'],
    'alchemical-society':['@alchemical-society.webp','50% 50%','cover'],technomagic:['@technomagic.webp','50% 28%','contain']
  };
  const categories = {
    'core-story':'characters', sanctuary:'places', duskkin:'characters', 'demons-legion':'characters',
    'road-sprites-streamliner':'creatures',lintels:'creatures','holy-items-guardians':'creatures',
    'character-stories':'characters','infinitys-quill':'places',wooburn:'places'
  };
  const short = {
    'core-story':'Ashai & Goaden',sanctuary:'Sanctuary in the Sky',duskkin:'The Duskkin',
    'demons-legion':"Demon’s Legion",'road-sprites-streamliner':'Road Sprites & Streamliner',
    lintels:'Lintels','holy-items-guardians':'Holy Items & Guardians','character-stories':'Character stories',
    'infinitys-quill':"Infinity’s Quill",wooburn:'Wooburn Forest'
  };
  Object.assign(short,extraTitles);
  const compatible = {
    'core-story':['demons-legion','sanctuary','holy-items-guardians','infinitys-quill','wooburn'],
    sanctuary:['demons-legion','road-sprites-streamliner','character-stories'],
    duskkin:['character-stories'],
    'demons-legion':['sanctuary','core-story','character-stories'],
    'road-sprites-streamliner':['lintels','sanctuary'],lintels:['road-sprites-streamliner','wooburn','holy-items-guardians'],
    'holy-items-guardians':['core-story','lintels','infinitys-quill'],
    'character-stories':['demons-legion','sanctuary','core-story'],
    'infinitys-quill':['core-story','holy-items-guardians','wooburn'],wooburn:['core-story','lintels','infinitys-quill']
  };
  catalog.crossovers.forEach(c=>{
    const base=projectById.get(c.baseProjectId);
    compatible[base.pillarId]=[...new Set([...(compatible[base.pillarId]||[]),c.addPillarId])];
  });
  const formats = {
    audio:['Audio & scene-aware storytelling','Narration, atmosphere and optional discoveries around a complete story.'],
    game:['Games & interactive play','A contained playable loop with a clear reason to return.'],
    animation:['Animation & screen','A short, a pilot scene or a focused adaptation proposal.'],
    publishing:['Publishing & illustrated stories','Prose, comics, webtoons and connected story editions.'],
    music:['Music & performance','An original release or a character-led performance collaboration.'],
    products:['Characters & consumer products','A focused collectible, companion or product concept.'],
    experience:['Experiences & discovery','An encounter, event or personal way into the world.'],
    custom:['Something different','Bring your own format and shape the idea together.']
  };
  const contributions = [
    ['production','Creative production','Art, animation, audio, writing or a development team.'],
    ['publishing','Publishing & distribution','A route to readers, listeners, players or viewers.'],
    ['funding','Development funding','Resources for a defined, agreed first milestone.'],
    ['music','Music & performance','Artists, repertoire, recording or performance expertise.'],
    ['products','Product & manufacturing','Design, prototyping, manufacturing or retail experience.'],
    ['audience','Audience & partnerships','Creator relationships, marketing or relevant communities.'],
    ['exploring','Exploring the fit','A promising idea and a conversation to start.']
  ];
  const relationships = [
    ['explore','Explore the possibilities'],['commission','Commission a pilot'],['co-produce','Co-develop or co-produce'],
    ['publish','Publish or distribute'],['license','Explore a category-specific licence'],['development','Resource a defined development stage']
  ];
  const steps = ['Choose your world','Format & project','Shape the partnership','Your project brief'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {step:0,pillar:'',format:'',project:'',focusedProject:false,projectSearch:'',showAllProjects:false,support:'',story:'',filter:'all',contributions:[],relationship:'explore',
    details:{title:'',audience:'',budget:'To discuss',timing:'To discuss',organisation:'',contact:'',need:'',notes:''},
    editedBrief:null,briefNeedsRefresh:false};
  let mounted = false;
  const pillar = () => byId.get(state.pillar);
  const story = () => pillar()?.storyOptions?.find(s => s.id === state.story);
  function availableFormats(p) {
    return [...new Set([...p.recommendedFormats.map(f=>f.id),...projects.filter(q=>q.pillarId===p.id).flatMap(q=>q.formats)])];
  }
  function matchingProjects() {
    return projects.filter(p=>p.pillarId===state.pillar && p.formats.includes(state.format) &&
      (state.pillar!=='character-stories' || !p.storyId || p.storyId===state.story))
      .sort((a,b)=>({featured:0,explore:1,crossover:2}[a.priority]-{featured:0,explore:1,crossover:2}[b.priority])||a.id.localeCompare(b.id));
  }
  function normaliseProject(preferred=state.project) {
    const matches=matchingProjects();
    state.project=preferred==='own'?'own':matches.find(p=>p.id===preferred)?.id || matches[0]?.id || '';
    const chosen=projectById.get(state.project);
    if(chosen?.addPillarId)state.support=chosen.addPillarId;
  }
  const selectedProject=()=>matchingProjects().find(p=>p.id===state.project);
  function selectedFormat() {
    const project=selectedProject();
    if(project) return {id:state.format,label:formats[state.format][0],buyer:project.partnerBrings,
      commercialRoute:project.commercialRoute,projectId:project.id,validation:project.validation,
      pilot:{title:project.title,scope:[pilotByFormat[project.id]?.[state.format] || project.firstPilot],existing:[project.existing],needed:[project.partnerBrings]}};
    const chosen = pillar()?.recommendedFormats.find(f => f.id === state.format) || {
      id:state.format || 'custom',label:formats[state.format]?.[0] || 'A new collaboration',buyer:'A partner with a distinctive proposal',
      commercialRoute:'Explore the creative fit and define a focused commercial route together.',
      pilot:{title:'An idea to shape together',scope:['Agree one clear audience and a first deliverable','Define what each partner contributes before expanding'],existing:pillar()?.silentBrings || [],needed:['A format proposal and the expertise to develop it','An agreed scope, budget and first decision point']}
    };
    const activeStory = story();
    if (activeStory && chosen.id !== 'custom') return {...chosen,pilot:{...chosen.pilot,scope:[`Develop one self-contained scene for ${activeStory.title}`, ...chosen.pilot.scope.slice(1)]}};
    return chosen;
  }
  function picture(id, className='', alt='') {
    let a = assets[id] || assets['core-story'];
    if (id === 'core-story' && alt) a = ['hero-cycle/rooftops-1280.webp','50% 50%','contain'];
    if (id === 'character-stories' && state.story === 'emily-grimm') a = ['gallery-refresh/emily-westminster-shadow-thumb.webp','46% 42%','cover'];
    const src=a[0].startsWith('@')?componentAssets+a[0].slice(1):imageBase+a[0];
    const special=id==='road-sprites-streamliner'?'sc-art-road':id==='lintels'?'sc-art-lintel':id==='holy-items-guardians'?'sc-art-pair':'';
    const background=id==='road-sprites-streamliner'?` style="background-image:linear-gradient(#08132155,#08132155),url('${componentAssets}road-sprite-bay.webp');background-size:cover;background-position:center"`:'';
    const image=id==='holy-items-guardians'?`<img src="${componentAssets}holy-item-example.webp" alt="" width="720" height="720" loading="lazy" decoding="async"><img src="${componentAssets}guardian-example.webp" alt="" width="720" height="720" loading="lazy" decoding="async">`:
      `<img src="${src}" alt="${esc(alt)}" width="620" height="349" loading="lazy" decoding="async" style="object-position:${a[1]};object-fit:${a[2]}">`;
    return `<span class="sc-art-frame ${className} ${special}"${background}>${image}</span>`;
  }
  function restoreLink() {
    if (!location.hash.startsWith('#build?')) return false;
    state.focusedProject = false;
    state.step = 0;
    const q = new URLSearchParams(location.hash.slice(7));
    const p = byId.get(q.get('world'));
    if (!p) return false;
    dirty();
    state.pillar = p.id;
    const linkedProject = projectById.get(q.get('project'));
    const possible = [...availableFormats(p),'custom'];
    state.format = possible.includes(q.get('format')) ? q.get('format') : p.recommendedFormats[0].id;
    state.support = (compatible[p.id] || []).includes(q.get('support')) ? q.get('support') : '';
    state.story = p.storyOptions?.find(s => s.id === q.get('story'))?.id ||
      p.storyOptions?.find(s => linkedProject?.pillarId === p.id && s.id === linkedProject.storyId)?.id || p.storyOptions?.[0].id || '';
    state.project=q.get('project') || '';
    state.projectSearch='';state.showAllProjects=false;
    normaliseProject();
    state.focusedProject = Boolean(linkedProject && linkedProject.pillarId === p.id &&
      linkedProject.formats.includes(q.get('format')) && selectedProject()?.id === linkedProject.id);
    if (state.focusedProject) state.step = 1;
    state.filter=coreIds.has(p.id)?'all':'more';
    state.relationship = relationships.some(r => r[0] === q.get('route')) ? q.get('route') : 'explore';
    state.contributions = (q.get('bring') || '').split(',').filter(id => contributions.some(c => c[0] === id));
    return state.focusedProject;
  }
  function shareLink() {
    const q = new URLSearchParams({world:state.pillar,format:state.format});
    if (state.support) q.set('support',state.support);
    if (state.story) q.set('story',state.story);
    if (state.project) q.set('project',state.project);
    if (state.relationship !== 'explore') q.set('route',state.relationship);
    if (state.contributions.length) q.set('bring',state.contributions.join(','));
    const url = new URL(location.href);
    url.hash = 'build?'+q.toString();
    return url.href;
  }
  function dirty() { if (state.editedBrief !== null) state.briefNeedsRefresh = true; }
  function announce(text) { mount.querySelector('.sc-feedback').textContent = text; }
  function choosePillar(id) {
    if (!byId.has(id)) return;
    state.focusedProject = false;
    if (state.pillar !== id) {
      dirty(); state.pillar = id; state.support = ''; state.story = pillar().storyOptions?.[0].id || '';state.project='';state.projectSearch='';state.showAllProjects=false;
      if (!availableFormats(pillar()).includes(state.format)) state.format = availableFormats(pillar())[0];
      normaliseProject();
    }
    renderStage(`[data-pillar="${id}"]`); renderPreview();
    announce(short[id]+' selected. Choose a format when you are ready.');
  }
  function title() { return state.details.title.trim() || selectedProject()?.title || story()?.title || selectedFormat().pilot.title; }
  function audience() { return state.details.audience.trim() || story()?.audience || pillar()?.audience || ''; }
  function proofLinks() {
    const existing=[...(story()?.proofLinks || []),...(pillar()?.proofLinks || [])];
    const key=url=>new URL(url,'https://thesecretsofsilverclouds.com').href;
    const labels={'/partners/':'Explore the audio overview','/soulsip/':'Play a bar shift','/streamliner-carriage/':'Enter the maintenance carriage','/read-play/':'Explore the existing experiences','/faction-quiz':'Discover a Holy Gift','/holy-gift':'Open the Holy Gift shrine'};
    const chosen=(selectedProject()?.sources || []).map(url=>({url,kind:'existing material',label:existing.find(l=>key(l.url)===key(url))?.label || labels[new URL(url,'https://thesecretsofsilverclouds.com').pathname] || 'Explore '+(new URL(url,'https://thesecretsofsilverclouds.com').pathname.split('/').filter(Boolean).pop() || 'Silver Clouds').replaceAll('-',' ')}));
    return [...chosen,...existing].filter((item,i,all)=>all.findIndex(other=>key(other.url)===key(item.url))===i).slice(0,3);
  }
  function generateBrief() {
    const p = pillar(), f = selectedFormat();
    if (!p) return '';
    const list = values => values.map(v => '- '+v).join('\n');
    return [
      'BUILD WITH SILVER CLOUDS','Exploratory partnership brief','',title(),'',
      'STARTING POINT',[p.title,f.projectId?'Project reference: '+f.projectId:'',story() ? 'Selected story: '+story().title : '',state.support ? 'Supporting element: '+byId.get(state.support).title : ''].filter(Boolean).join('\n'),'',
      selectedProject()?.hook || story()?.hook || p.hook,'','FORMAT',f.label,'','INTENDED AUDIENCE',audience(),'',
      'PARTNERSHIP ROUTE',relationships.find(r => r[0] === state.relationship)[1],f.commercialRoute,'',
      'FIRST PROJECT TO DISCUSS',list(f.pilot.scope),'',
      'WHAT EXISTS TODAY',selectedProject()?.status || p.status,list(f.pilot.existing),'',
      'WHAT SILVER CLOUDS BRINGS',list(p.silentBrings),'',
      'WHAT I / WE BRING',[state.contributions.length ? list(state.contributions.map(id => contributions.find(c => c[0] === id)[1])) : 'To discuss',
      state.details.organisation ? 'Organisation / role: '+state.details.organisation : '',
      state.details.contact ? 'Contact: '+state.details.contact : ''].filter(Boolean).join('\n'),'',
      'WHAT WE NEED TO DEFINE',[list(f.pilot.needed),state.details.need].filter(Boolean).join('\n'),
      'Indicative resources / budget: '+(state.details.budget.trim() || 'To discuss'),
      'Preferred timing: '+(state.details.timing.trim() || 'To discuss'),'',
      f.validation?(selectedProject()?.priority==='crossover'?'WHY TEST THIS':'WHAT TO VALIDATE')+'\n'+f.validation+'\n':'',
      state.details.notes ? 'ADDITIONAL IDEAS\n'+state.details.notes+'\n' : '',
      'EXISTING MATERIALS',...proofLinks().map(link => link.label+': '+new URL(link.url,'https://thesecretsofsilverclouds.com').href),'',
      'NEXT CONVERSATION','Agree creative fit, scope, responsibilities, rights and the first milestone.',
      'This brief proposes a collaboration. Availability and commercial terms are to be agreed with Silent Silver.',
      'thesecretsofsilverclouds@gmail.com'
    ].filter(line => line !== undefined && line !== null).join('\n').replace(/\n{3,}/g,'\n\n');
  }
  function getBrief() { return state.editedBrief ?? generateBrief(); }
  function init() {
    if (mounted) return false;
    mounted = true; restoreLink();
    mount.innerHTML = `<div class="sc-builder" data-step="0">
      <section class="sc-builder-hero" aria-labelledby="sc-builder-title">
        <div><p class="sc-kicker">Build with Silver Clouds</p><h1 id="sc-builder-title">One universe.<br><em>Your next project.</em></h1>
          <p class="sc-builder-intro">A floating nightclub. Cyber-vampire hunters. A little cloud to call your own. Choose a corner of the world and shape what you could build with it.</p>
          <div class="sc-proof-row"><span>Original British fantasy</span><span>Existing stories & experiences</span><span>Start with a focused pilot</span></div>
        </div><figure class="sc-hero-image">${picture('core-story','','Ashai and Goaden with their Guardians above magical London.')}<figcaption>British fantasy. Anime energy. A world with room for your ideas.</figcaption></figure>
      </section>
      <nav aria-label="Project builder steps"><ol class="sc-stepper">${steps.map((s,i) => `<li><button type="button" data-step="${i}"><span>${i+1}</span>${s}</button></li>`).join('')}</ol></nav>
      <div class="sc-builder-layout"><div class="sc-workspace"><div class="sc-stage"></div><div class="sc-navigation"></div></div><aside class="sc-project-preview" aria-label="Your project taking shape"></aside></div>
      <p class="sc-feedback" role="status" aria-live="polite"></p>
      <p class="sc-notice">A starting conversation, shaped around your expertise. Every project begins with an agreed scope, creative approach and commercial terms.</p>
    </div>`;
    mount.addEventListener('click',onClick);
    mount.addEventListener('change',onChange);
    mount.addEventListener('input',onInput);
    renderStage(); renderPreview();
    if (state.focusedProject) focusStage();
    return true;
  }
  function canVisit(step) { return step === 0 || Boolean(pillar()); }
  function focusStage() {
    requestAnimationFrame(() => {
      const heading = mount.querySelector('.sc-stage-heading h2');
      if (!heading) return;
      heading.tabIndex = -1; heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'start',behavior:state.focusedProject || matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
  }
  function go(step) {
    if (!canVisit(step)) return;
    if (step === 0) state.focusedProject = false;
    state.step = step; renderStage(); renderPreview();
    focusStage();
  }
  function selectedWorld() {
    const p = pillar();
    return `<div class="sc-selected-world">${picture(p.id)}<div><span class="sc-preview-label">Your starting point</span><strong>${esc(short[p.id])}</strong></div><button class="sc-link" type="button" data-go="0">Change</button></div>`;
  }
  function chooseProject(id) {
    const project=projectById.get(id);
    if(id!=='own' && !project)return;
    const focused = state.focusedProject && Boolean(project);
    dirty();state.project=id;
    if(project){
      if(state.pillar!==project.pillarId){state.pillar=project.pillarId;state.support='';state.story=byId.get(state.pillar).storyOptions?.[0].id || '';}
      if(!project.formats.includes(state.format))state.format=project.formats[0];
      if(project.storyId)state.story=project.storyId;
      if(project.addPillarId)state.support=project.addPillarId;
    }
    state.focusedProject = focused;
    state.projectSearch='';state.showAllProjects=false;
    renderStage(focused?'':`[data-project-choice="${state.project}"]`);renderPreview();
    if (focused) focusStage();
    announce(id==='own'?'Your own project direction selected.':project.title+' selected.');
  }
  function projectResults() {
    const query=state.projectSearch.trim().toLowerCase();
    return matchingProjects().filter(p=>!query || (p.id+' '+p.title+' '+p.hook).toLowerCase().includes(query));
  }
  function projectOptionRows() {
    const matches=projectResults();
    let visible=state.showAllProjects?matches:matches.slice(0,4);
    const chosen=matches.find(p=>p.id===state.project);
    if(chosen && !visible.includes(chosen) && !state.showAllProjects)visible=[...visible.slice(0,3),chosen];
    return visible.map(p=>`<label class="sc-project-option"><input type="radio" class="sc-project-radio" name="sc-project" value="${p.id}" data-project-choice="${p.id}" ${state.project===p.id?'checked':''}><span class="sc-project-option-copy"><strong>${esc(p.title)}</strong><span>${esc(p.hook)}</span><span class="sc-project-count">${p.id} · ${esc(p.status)}</span>${p.priority==='featured'?'<span class="sc-featured-label">Featured starting point</span>':p.priority==='crossover'?'<span class="sc-featured-label">Crossover direction</span>':''}</span></label>`).join('')+
      `<label class="sc-project-option"><input type="radio" class="sc-project-radio" name="sc-project" value="own" data-project-choice="own" ${state.project==='own' || !matchingProjects().length?'checked':''}><span class="sc-project-option-copy"><strong>${matchingProjects().length?'My own project idea':'Build from this world’s starter'}</strong><span>Use the existing world and format as a starting point, then describe your own project.</span></span></label>`;
  }
  function projectPicker(showDetail=true) {
    const matches=matchingProjects(), project=selectedProject(), f=selectedFormat();
    const related=project ? projects.filter(p=>p.baseProjectId===(project.baseProjectId || project.id) && p.id!==project.id) : [];
    return `<div class="sc-project-library"><fieldset class="sc-project-options"><legend>Choose a starting project</legend><p class="sc-project-count">${matches.length?matches.length+' relevant '+(matches.length===1?'idea':'ideas')+' for this world and format.':'An authored starter for this part of the world.'} The brief bank contains ${catalog.projects.length} proposals and ${catalog.crossovers.length} optional crossover directions.</p>
      ${matches.length>4?'<label class="sc-catalog-search" for="sc-project-search">Find a project<input type="search" id="sc-project-search" placeholder="Search project titles or references" maxlength="100" value="'+esc(state.projectSearch)+'"></label>':''}
      <div class="sc-project-list">${projectOptionRows()}</div>
      ${matches.length>4?'<button class="sc-project-more sc-link" type="button" data-action="more-projects">'+(state.showAllProjects?'Show fewer ideas':'More project ideas ('+matches.length+')')+'</button>':''}
      </fieldset>${showDetail?`<section class="sc-project-detail" aria-label="Selected project details"><p class="sc-preview-label">${project?esc(project.id)+' · Proposed first pilot':'An authored world starter'}</p><h3>${esc(f.pilot.title)}</h3><p>${esc(f.pilot.scope.join(' '))}</p><dl><dt>Existing material</dt><dd>${esc(project?.existing || f.pilot.existing.join(' '))}</dd><dt>Partner contribution</dt><dd>${esc(project?.partnerBrings || f.pilot.needed.join(' '))}</dd>${project?'<dt>What to validate</dt><dd>'+esc(project.validation)+'</dd>':''}</dl></section>`:''}
      ${related.length?`<details class="sc-crossover-suggestions"><summary>Explore a crossover variation</summary><ul>${related.map(p=>`<li><strong>${esc(p.title)}</strong><p>${esc(p.formatLabels.join(' · '))}</p><p>${esc(p.firstPilot)}</p><button type="button" class="sc-link" data-project="${p.id}">Explore ${esc(p.title)}</button></li>`).join('')}</ul></details>`:''}</div>`;
  }
  function projectChoices(p, showDetail=true) {
    return `${p.storyOptions ? `<fieldset class="sc-story-options"><legend>Choose the character story</legend>${p.storyOptions.map(s => `<button type="button" data-story="${s.id}" aria-pressed="${state.story===s.id}">${esc(s.title)}</button>`).join('')}<p class="sc-field-note">${esc(story()?.hook)}</p></fieldset>` : ''}
      <div class="sc-choice-list" role="group" aria-label="Project format">${[...availableFormats(p),'custom'].map(id => `<button type="button" class="sc-choice-card" data-format="${id}" aria-pressed="${state.format===id}"><span class="sc-choice-title">${esc(formats[id][0])}</span><span class="sc-choice-desc">${esc(p.recommendedFormats.find(f => f.id === id && f.label!==id)?.label || formats[id][1])}</span></button>`).join('')}</div>
      ${projectPicker(showDetail)}
      <div class="sc-support-field"><label for="sc-support">${selectedProject()?.addPillarId?'This crossover includes':'Add a supporting element <span>(optional)</span>'}</label><select id="sc-support" ${selectedProject()?.addPillarId?'disabled':''}><option value="">Keep the focus on ${esc(short[p.id])}</option>${(compatible[p.id] || []).map(id => `<option value="${id}" ${state.support===id?'selected':''}>${esc(short[id])}</option>`).join('')}</select><p class="sc-field-note">${selectedProject()?.addPillarId?'Choose “My own project idea” to change the supporting world.':'One complementary ingredient can add flavour. The first project keeps a focused scope.'}</p></div>`;
  }
  function renderStage(restoreFocus='') {
    const alternativesOpen = mount.querySelector('.sc-project-alternatives')?.open || false;
    mount.querySelector('.sc-builder').dataset.step = state.step;
    mount.querySelector('.sc-builder').dataset.focusedProject = String(state.focusedProject);
    mount.querySelectorAll('.sc-stepper button').forEach((button,i) => {
      button.disabled = !canVisit(i);
      if (state.step === i) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
    });
    const stage = mount.querySelector('.sc-stage');
    if (state.step === 0) {
      stage.innerHTML = `<div class="sc-stage-heading"><p class="sc-kicker">A world of starting points</p><h2>Where would you like to build?</h2><p>Pick what sparks an idea. Each pillar comes with existing material and a first project to explore.</p></div>
        <div class="sc-filter-row" role="group" aria-label="Filter starting points">${[['all','All pillars'],['characters','Characters & factions'],['places','Places & stories'],['creatures','Creatures & powers'],['more','More worlds']].map(([id,label]) => `<button type="button" data-filter="${id}" aria-pressed="${state.filter===id}">${label}</button>`).join('')}</div>
        <div class="sc-pillar-grid">${pillars.filter(p => state.filter==='more'?!coreIds.has(p.id):coreIds.has(p.id) && (state.filter==='all' || categories[p.id]===state.filter)).map(p => `<button type="button" class="sc-pillar-card" data-pillar="${p.id}" aria-pressed="${state.pillar===p.id}">${picture(p.id)}<span class="sc-card-copy"><strong>${esc(short[p.id])}</strong><span>${esc(p.hook)}</span><small>${esc(p.status)}</small></span></button>`).join('')}</div>`;
    } else if (state.step === 1) {
      const p = pillar(), project = selectedProject(), f = selectedFormat();
      stage.innerHTML = state.focusedProject && project ? `${selectedWorld()}
        <div class="sc-stage-heading"><p class="sc-kicker">Your selected project</p><h2>${esc(project.title)}</h2><p>${esc(project.hook)}</p><p class="sc-route-format">${esc(f.label)} · ${esc(project.id)}</p></div>
        <section class="sc-project-detail sc-project-focus" aria-label="Selected project proposal"><h3>A focused first pilot</h3><p>${esc(f.pilot.scope.join(' '))}</p><div class="sc-focused-actions"><button type="button" class="sc-button" data-go="2">Shape the partnership</button><a class="sc-link" href="${esc(proofHref(proofLinks()[0]?.url || '/episode-one/'))}" target="_blank" rel="noopener noreferrer">Review the source material</a></div><dl><dt>Existing material</dt><dd>${esc(project.existing)}</dd><dt>Partner contribution</dt><dd>${esc(project.partnerBrings)}</dd><dt>Commercial route</dt><dd>${esc(project.commercialRoute)}</dd></dl></section>
        <details class="sc-project-alternatives"${alternativesOpen?' open':''}><summary>Explore other formats or project ideas</summary><div class="sc-project-alternatives-body">${projectChoices(p,false)}</div></details>` :
        `${selectedWorld()}<div class="sc-stage-heading"><p class="sc-kicker">Find the right expression</p><h2>What would you make?</h2><p>These formats have a natural fit with ${esc(short[p.id])}. You can also bring a different idea.</p></div>${projectChoices(p)}`;
    } else if (state.step === 2) {
      stage.innerHTML = `${selectedWorld()}<div class="sc-stage-heading"><p class="sc-kicker">Make room for your expertise</p><h2>What could we bring together?</h2><p>Choose your contribution and add as much detail as you have. It is fine to leave the scope open.</p></div>
        <fieldset class="sc-contributions"><legend>What could you bring?</legend>${contributions.map(([id,label,desc]) => `<label><input type="checkbox" data-contribution="${id}" ${state.contributions.includes(id)?'checked':''}><span><strong>${label}</strong><span>${desc}</span></span></label>`).join('')}</fieldset>
        <div class="sc-form-grid"><div class="sc-field sc-field-wide"><label for="sc-relationship">How would you like to work together?</label><select id="sc-relationship">${relationships.map(([id,label]) => `<option value="${id}" ${state.relationship===id?'selected':''}>${label}</option>`).join('')}</select></div>
        ${input('title','Working project title',selectedFormat().pilot.title,120,'sc-field-wide')}
        ${input('audience','Who is it for?',story()?.audience || pillar().audience,280,'sc-field-wide')}
        ${input('budget','Indicative resources or budget','To discuss',120)}${input('timing','Preferred timing','To discuss',120)}
        ${input('organisation','Your organisation or role','Optional',120)}${input('contact','Your contact details','Optional email or preferred contact',180)}
        <div class="sc-field sc-field-wide"><label for="sc-need">What would you want from Silver Clouds?</label><textarea id="sc-need" data-detail="need" rows="3" maxlength="1200" placeholder="Creative direction, source material, a production partner, distribution…">${esc(state.details.need)}</textarea></div>
        <div class="sc-field sc-field-wide"><label for="sc-notes">Your idea, in your words</label><textarea id="sc-notes" data-detail="notes" rows="3" maxlength="1600" placeholder="Anything that would make this project yours.">${esc(state.details.notes)}</textarea></div></div>
        <p class="sc-field-note">These details stay in this page until you copy, download or email your brief. A shared concept link contains only the selected options.</p>`;
    } else {
      stage.innerHTML = `<div class="sc-stage-heading"><p class="sc-kicker">A beginning you can share</p><h2>Your project, taking shape.</h2><p>Edit the brief in your own voice, then use it to start a conversation with Silent.</p></div>
        <article class="sc-result-card"><p class="sc-preview-label">Exploratory partnership brief</p><h3>${esc(title())}</h3>
        <label for="sc-brief" class="sc-preview-label">Your editable brief</label><textarea id="sc-brief" class="sc-brief-text" rows="18" spellcheck="true">${esc(getBrief())}</textarea><pre class="sc-print-brief"></pre>
        <p class="sc-field-note sc-refresh-note" ${state.briefNeedsRefresh?'':'hidden'}>Your edits are preserved. Update from choices to include changes made in earlier steps.</p>
        <div class="sc-result-actions"><button type="button" class="sc-button" data-action="email">Open project email</button><button type="button" class="sc-button sc-button-secondary" data-action="copy">Copy brief</button><button type="button" class="sc-button sc-button-secondary" data-action="download">Download brief (.txt)</button><button type="button" class="sc-link" data-action="print">Print / save PDF</button></div>
        <div class="sc-result-actions"><button type="button" class="sc-link" data-action="share">Copy concept link</button><button type="button" class="sc-link" data-action="regenerate">Update brief from choices</button></div>
        <p class="sc-field-note">The email opens a short enquiry draft. Copy or download your full brief to include the complete proposal and any final edits, then paste it into the email or attach the file before sending.</p></article>
        <div class="sc-result-grid"><section><h3>Explore the existing material</h3><ul class="sc-evidence-links">${proofLinks().map(link => `<li><a class="sc-link" href="${esc(proofHref(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label)}</a><span>${esc(link.kind)}</span></li>`).join('')}</ul></section><section><h3>The first conversation</h3><p>Agree the creative fit, what each partner brings and a focused first milestone. The brief is a starting proposal; commercial terms and availability are discussed together.</p><button type="button" class="sc-reset sc-link" data-action="reset">Start another project</button></section></div>`;
      mount.querySelector('.sc-print-brief').textContent = getBrief();
    }
    mount.querySelector('.sc-navigation').innerHTML = `<button type="button" class="sc-button sc-button-secondary" data-go="${state.step-1}" ${state.step===0?'hidden':''}>Back</button><span class="sc-progress-label">${state.step+1} of ${steps.length}</span><button type="button" class="sc-button" data-go="${state.step+1}" ${state.step===3?'hidden':''} ${!pillar()?'disabled':''}>${state.step===2?'Create my brief':state.step===0?'Choose a format':'Shape the partnership'}</button>`;
    if (restoreFocus) mount.querySelector(restoreFocus)?.focus({preventScroll:true});
  }
  function input(key,label,placeholder,maxlength,extra='') {
    return `<div class="sc-field ${extra}"><label for="sc-${key}">${label}</label><input id="sc-${key}" data-detail="${key}" type="text" maxlength="${maxlength}" value="${esc(state.details[key])}" placeholder="${esc(placeholder)}"></div>`;
  }
  function renderPreview() {
    const box = mount.querySelector('.sc-project-preview');
    const p = pillar();
    if (!p) {
      box.innerHTML = `${picture('sanctuary','sc-preview-art')}<div class="sc-preview-copy"><p class="sc-preview-label">Your project canvas</p><h3 class="sc-preview-title">Start with a spark.</h3><p>Choose a pillar to see its story, creative possibilities and an achievable first project.</p><div class="sc-preview-tags"><span class="sc-pill">Your world</span><span class="sc-pill">Your format</span><span class="sc-pill">A shared beginning</span></div></div><div class="sc-preview-footer">Ten starting points, more worlds to explore. ${catalog.projects.length} project proposals and ${catalog.crossovers.length} crossover directions.</div>`;
      return;
    }
    const f = selectedFormat(), project=selectedProject();
    box.innerHTML = `${picture(p.id,'sc-preview-art')}<div class="sc-preview-copy"><p class="sc-preview-label">Your project canvas${project?' · '+esc(project.id):''}</p><h3 class="sc-preview-title">${esc(title())}</h3><div class="sc-preview-tags"><span class="sc-pill">${esc(short[p.id])}</span><span class="sc-pill">${esc(formats[state.format]?.[0] || f.label)}</span></div>${state.support?`<p class="sc-field-note">With ${esc(short[state.support])}</p>`:''}<p class="sc-preview-summary">${esc(project?.hook || story()?.hook || p.hook)}</p><dl class="sc-preview-meta"><dt>First milestone</dt><dd>${esc(f.pilot.scope[0])}</dd><dt>Material today</dt><dd>${esc(project?.status || p.status)}</dd><dt>Your contribution</dt><dd>${state.contributions.length?esc(state.contributions.map(id => contributions.find(c => c[0]===id)[1]).join(', ')):'Choose what you could bring.'}</dd></dl><a class="sc-link" href="${esc(proofHref(proofLinks()[0]?.url || '/episode-one/'))}" target="_blank" rel="noopener noreferrer">${esc(proofLinks()[0]?.label || 'Explore the story')}</a>${state.step<3?`<button type="button" class="sc-button" data-go="${state.step+1}">${state.step===0?'Continue with this world':state.step===1?'Shape this project':'Create my brief'}</button>`:''}</div><div class="sc-preview-footer">Visual development and existing demonstrations inform a new project. Scope is agreed together.</div>`;
  }
  async function copyText(text,success) {
    try { await navigator.clipboard.writeText(text); announce(success); }
    catch (_) {
      const field = mount.querySelector('#sc-brief');
      if (field && text === getBrief()) { field.focus(); field.select(); announce('The brief is selected. Use your keyboard’s copy command.'); }
      else { const anchor = document.createElement('a'); anchor.href=text; anchor.textContent=text; const status=mount.querySelector('.sc-feedback');status.replaceChildren('Copy this concept link: ',anchor); }
    }
  }
  function onClick(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.pillar) { choosePillar(button.dataset.pillar); return; }
    if (button.dataset.filter) { state.filter=button.dataset.filter; renderStage(`[data-filter="${state.filter}"]`); return; }
    if (button.dataset.format) { dirty();state.focusedProject=false;state.format=button.dataset.format;state.project='';state.projectSearch='';state.showAllProjects=false;normaliseProject();renderStage(`[data-format="${state.format}"]`);renderPreview();announce(formats[state.format][0]+' selected.');return; }
    if (button.dataset.story) { dirty();state.focusedProject=false;state.story=button.dataset.story;state.project='';normaliseProject();renderStage(`[data-story="${state.story}"]`);renderPreview();return; }
    if (button.dataset.project) { chooseProject(button.dataset.project);return; }
    if (button.dataset.go !== undefined) { go(Number(button.dataset.go)); return; }
    if (button.dataset.step !== undefined) { go(Number(button.dataset.step)); return; }
    const action = button.dataset.action;
    if(action==='more-projects'){state.showAllProjects=!state.showAllProjects;renderStage('[data-action="more-projects"]');return;}
    if (action === 'copy') copyText(getBrief(),'Project brief copied.');
    if (action === 'share') copyText(shareLink(),'Concept link copied. Your personal details and edited brief are excluded.');
    if (action === 'regenerate') {state.editedBrief=null;state.briefNeedsRefresh=false;renderStage('[data-action="regenerate"]');announce('Brief updated from your current choices.');}
    if (action === 'print') {mount.querySelector('.sc-print-brief').textContent=getBrief();window.print();}
    if (action === 'download') {
      const url=URL.createObjectURL(new Blob(['\uFEFF'+getBrief()],{type:'text/plain;charset=utf-8'}));
      const reference=selectedProject()?.id || state.pillar;
      const a=document.createElement('a');a.href=url;a.download='Silver-Clouds-'+reference+'-Partnership-Brief.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Your text brief has been downloaded. Use Print / save PDF for a print-ready version.');
    }
    if (action === 'email') {
      const body=[title(),selectedProject()?'Project reference: '+selectedProject().id:'',state.details.notes?'My idea: '+state.details.notes.slice(0,320):'',short[state.pillar],selectedFormat().label,state.support?'With '+short[state.support]:'',
        'Partnership: '+relationships.find(r=>r[0]===state.relationship)[1],
        'I / we bring: '+(state.contributions.map(id=>contributions.find(c=>c[0]===id)[1]).join(', ')||'To discuss'),
        state.details.organisation,state.details.contact,state.details.need,
        'I would like to discuss a focused first project. I can provide the full brief separately.'].filter(Boolean).join('\n').slice(0,900);
      location.href='mailto:thesecretsofsilverclouds@gmail.com?subject='+encodeURIComponent('Build with Silver Clouds: '+title().slice(0,90))+'&body='+encodeURIComponent(body);
      announce('Email draft opened. You can also copy or download the complete brief.');
    }
    if (action === 'reset') {
      Object.assign(state,{step:0,pillar:'',format:'',project:'',focusedProject:false,projectSearch:'',showAllProjects:false,support:'',story:'',filter:'all',contributions:[],relationship:'explore',editedBrief:null,briefNeedsRefresh:false});
      Object.keys(state.details).forEach(key=>state.details[key]=['budget','timing'].includes(key)?'To discuss':'');
      const url=new URL(location.href);url.hash='build';history.replaceState(null,'',url.href);go(0);announce('Ready for another idea.');
    }
  }
  function onChange(event) {
    const el=event.target;
    if(el.dataset.projectChoice){chooseProject(el.dataset.projectChoice);return;}
    if (el.dataset.contribution) {
      dirty();
      if (el.checked) {
        if(el.dataset.contribution==='exploring')state.contributions=['exploring'];
        else state.contributions=[...state.contributions.filter(id=>id!=='exploring' && id!==el.dataset.contribution),el.dataset.contribution];
      } else state.contributions=state.contributions.filter(id=>id!==el.dataset.contribution);
      mount.querySelectorAll('[data-contribution]').forEach(input=>input.checked=state.contributions.includes(input.dataset.contribution));renderPreview();
    }
    if(el.id==='sc-support'){dirty();state.support=selectedProject()?.addPillarId || el.value;renderPreview();}
    if(el.id==='sc-relationship'){dirty();state.relationship=el.value;}
  }
  function onInput(event) {
    const el=event.target;
    if(el.id==='sc-project-search'){state.projectSearch=el.value;mount.querySelector('.sc-project-list').innerHTML=projectOptionRows();const more=mount.querySelector('[data-action="more-projects"]');if(more){more.hidden=projectResults().length<=4;more.textContent=state.showAllProjects?'Show fewer ideas':'More project ideas ('+projectResults().length+')';}return;}
    if (el.dataset.detail) {dirty();state.details[el.dataset.detail]=el.value;if(el.dataset.detail==='title')renderPreview();}
    if (el.id==='sc-brief') {state.editedBrief=el.value;mount.querySelector('.sc-print-brief').textContent=el.value;}
  }
  document.addEventListener('click',event=>{
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[data-build-own]');
    if (!anchor || (anchor.target && anchor.target !== '_self')) return;
    init();go(0);
  });
  document.addEventListener('sc:partner-tab',event=>{if(event.detail.name==='build')init();});
  addEventListener('hashchange',()=>{
    if(location.hash.startsWith('#build?')){
      if (init()) return;
      restoreLink();renderStage();renderPreview();
      if (state.focusedProject) focusStage();
    }
  });
  if (!document.getElementById('build-panel')?.hidden) init();
})();

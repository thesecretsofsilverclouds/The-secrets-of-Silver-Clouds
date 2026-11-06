/* Local, deterministic RoadSprite workshop model. No DOM, network or timers. */
(function (global) {
  'use strict';
  const VERSION=1,DEFAULT_KEY='streamliner-maintenance-local-v1';
  const LIMITS={bestRepairs:3,completedJobs:36,discoveries:8,shift:1000000000};
  const SLOTS=['power','control','output'];
  const KINDS=['lighting','window','announcement'];
  const ROUTES=['Westminster · riverside','South Bank · evening line','City · after dark','Waterloo · river approach','West End · late service','Blackfriars · river crossing'];
  const PARTS=[
    {id:'pulse-cell',slot:'power',name:'Pulse Cell',icon:'cell',description:'An even little heartbeat. One unit of energy gives one unit of drive; it stays comfortable up to 75.',properties:{gain:1,stability:95,comfort:75}},
    {id:'storm-capacitor',slot:'power',name:'Storm Capacitor',icon:'capacitor',description:'Stores a pocket of thunder: 25% more drive, with a less steady pulse. Loads above 68 need care.',properties:{gain:1.25,stability:78,comfort:68}},
    {id:'prism-coil',slot:'control',name:'Prism Coil',icon:'prism',description:'Focuses 23% more light and sharpens harmonics, trading a little steadiness and airflow.',properties:{focus:1.23,airflow:.84,stability:80,harmonicBonus:9}},
    {id:'steady-regulator',slot:'control',name:'Steady Regulator',icon:'regulator',description:'Smooths the pulse into a dependable flow. A forgiving place to begin.',properties:{focus:1,airflow:1.02,stability:98,harmonicBonus:4}},
    {id:'lumen-lens',slot:'output',name:'Lumen Lens',icon:'lens',description:'Turns drive into a bright ribbon of light. Its faceted ring sings best near 45 drive; very little air escapes.',properties:{light:1.1,airflow:.22,tuningPoint:45,comfort:78}},
    {id:'air-impeller',slot:'output',name:'Air Impeller',icon:'impeller',description:'Turns drive into a clearing breeze, with a soft status glow. Its vanes make a clear note near 57 drive.',properties:{light:.56,airflow:1.28,tuningPoint:57,comfort:90}}
  ];
  const BY_ID=Object.fromEntries(PARTS.map(part=>[part.id,part]));
  const JOBS=[
    {kind:'lighting',title:'Steady the carriage lights',hint:'Begin with a Pulse Cell, Steady Regulator and Lumen Lens at 50–65 energy. Then try a different way to hold the same glow.',target:{light:{min:46,max:82},stability:{min:72},airflow:{max:55}},briefs:['The carriage lamps flutter whenever the Streamliner leans. Give the passengers a steady, comfortable glow.','The carriage reading lights have faded to pinpricks. Bring back their glow without setting the fittings rattling.','The reading-carriage lights flare at every bend. Settle them into an even ribbon of light.']},
    {kind:'window',title:'Clear the rainward windows',hint:'A clearing charm needs moving air. Try the Air Impeller and tune the breeze so it clears mist without buffeting the carriage.',target:{airflow:{min:48,max:86},stability:{min:70}},briefs:['River mist has clouded the carriage windows. Send a smooth breeze through the clearing ward.','A veil of street pollen is hiding the buildings outside. Lift it away with an even, measured current.','The cold night has fogged the riverside windows. Clear the glass without making the seals shiver.']},
    {kind:'announcement',title:'Tune the next-stop chime',hint:'Harmonics describe how clearly the circuit sings. Each output has a sweet spot; a steady pulse helps its note carry.',target:{harmonics:{min:78},stability:{min:74},power:{min:25,max:76}},briefs:['The next-stop charm is answering itself with a wobbling echo. Find one clear note at a comfortable drive.','The conductor’s welcome has picked up a buzzing overtone. Give the announcement ring a clear voice again.','Two platforms are sharing one confused chime. Tune a clean note the passengers can follow.']}
  ];
  const LABELS={power:'Drive',stability:'Stability',light:'Light',airflow:'Airflow',harmonics:'Harmonics'};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,lo=0,hi=100)=>Math.max(lo,Math.min(hi,value));
  const round=value=>Math.round(clamp(value));
  const emptyBuild=()=>({power:null,control:null,output:null});
  const complete=build=>SLOTS.every(slot=>BY_ID[build[slot]]?.slot===slot);
  const combinationId=build=>SLOTS.map(slot=>build[slot]).join('|');
  const combinationName=build=>SLOTS.map(slot=>BY_ID[build[slot]].name).join(' + ');
  const freshProgress=()=>({shift:1,bestRepairs:[],completedJobs:[],discoveries:[]});
  function jobAt(shift){
    const index=(shift-1)%3,day=Math.floor((shift-1)/3)+1,template=JOBS[index];
    const route=ROUTES[(day-1+index*2)%ROUTES.length];
    return {id:`${template.kind}-day-${day}`,kind:template.kind,title:template.title,day,route,brief:template.briefs[(day-1)%template.briefs.length],hint:template.hint,target:clone(template.target)};
  }
  function evaluateBuild(build,setting,job){
    const missing=SLOTS.filter(slot=>!BY_ID[build[slot]]);
    if(missing.length){
      const names=missing.map(slot=>({power:'a source',control:'a control',output:'an output'})[slot]);
      const needed=names.length===1?names[0]:`${names.slice(0,-1).join(', ')} and ${names[names.length-1]}`;
      return {complete:false,ready:false,successful:false,power:0,stability:0,light:0,airflow:0,harmonics:0,quality:0,checks:[],combinationId:null,diagnostic:`Choose ${needed} from the drawer to complete the circuit.`,spriteLine:'A source gives it a heartbeat. A control gives it manners. An output gives it a job.'};
    }
    const cell=BY_ID[build.power].properties,control=BY_ID[build.control].properties,output=BY_ID[build.output].properties;
    const drive=setting*cell.gain;
    // Overdriving a power source or output adds wobble, rather than a random fail.
    const stability=round((cell.stability+control.stability)/2-Math.max(0,drive-cell.comfort)*.65-Math.max(0,drive-output.comfort)*.35);
    const values={power:round(drive),stability,light:round(drive*control.focus*output.light),airflow:round(drive*control.airflow*output.airflow),harmonics:round((100-Math.abs(drive-output.tuningPoint)*.95-(100-stability)*.7+control.harmonicBonus)*Math.min(1,drive/25))};
    const checks=Object.entries(job.target).map(([key,target])=>({key,label:LABELS[key],value:values[key],target:target.min!==undefined&&target.max!==undefined?`${target.min}–${target.max}`:target.min!==undefined?`${target.min} or more`:`${target.max} or less`,pass:(target.min===undefined||values[key]>=target.min)&&(target.max===undefined||values[key]<=target.max)}));
    const successful=checks.every(check=>check.pass);
    const quality=Math.round(checks.reduce((sum,check)=>{
      const target=job.target[check.key],value=check.value;
      if(!check.pass){const distance=target.min!==undefined&&value<target.min?target.min-value:value-target.max;return sum+clamp(65-distance*2);}
      if(target.min!==undefined&&target.max!==undefined){const center=(target.min+target.max)/2;return sum+100-Math.abs(value-center)/((target.max-target.min)/2)*22;}
      return sum+75+(target.min!==undefined?(value-target.min)/(100-target.min):(target.max-value)/target.max)*25;
    },0)/checks.length);
    let diagnostic,spriteLine;
    if(!drive){diagnostic='The circuit is complete, but no energy is reaching the charm. Raise the energy to see what this assembly does.';spriteLine='Lovely little machine. Shall we let it wake up?';}
    else if(successful){
      diagnostic={lighting:'The light holds a comfortable, steady ribbon. The carriage fittings stay quiet.',window:'An even breeze lifts the mist from the glass. The seals stay settled.',announcement:'A clear next-stop note carries through the carriage without a wobble or a shout.'}[job.kind];
      spriteLine={lighting:'There. Enough glow to find a page, without dazzling the carriage.',window:'London was hiding behind that glass.',announcement:'One clear note. Even the conductor will call that a tune.'}[job.kind];
    }else{
      const failed=checks.find(check=>!check.pass),target=job.target[failed.key];
      const low=target.min!==undefined&&failed.value<target.min;
      if(failed.key==='stability')diagnostic='The output is wavering under this load. Lower the energy, or use a steadier cell or regulator.';
      else if(failed.key==='light')diagnostic=low?'The charm is steady enough to inspect, but its glow is too dim. Raise energy, focus it with the Prism Coil, or choose the Lumen Lens.':'The light is washing out the carriage. Lower the energy to keep a comfortable glow.';
      else if(failed.key==='airflow')diagnostic=low?'The circuit makes more glow than breeze. The Air Impeller, or a little more energy, will move the mist.':'The draft is stronger than this charm needs. Lower the energy; for a lamp, the Lumen Lens keeps the output in the light.';
      else if(failed.key==='harmonics')diagnostic=`The note is blurred. This output rings best near ${output.tuningPoint} drive; tune towards that point and keep the pulse steady.`;
      else diagnostic=low?'The note needs a little more drive to reach the passengers. Raise the energy gently.':'The announcement is being pushed too hard. Lower the energy for a comfortable voice.';
      spriteLine='No wasted tries. It is telling us what this circuit likes.';
    }
    return {complete:true,ready:successful,successful,...values,quality,checks,combinationId:combinationId(build),combinationName:combinationName(build),behavior:build.output==='lumen-lens'?'Focused light, a faint vent breeze, and a faceted ringing note.':'A curling breeze, a soft status glow, and a note from the spinning vanes.',diagnostic,spriteLine};
  }
  function validBuild(value){return value&&typeof value==='object'&&SLOTS.every(slot=>BY_ID[value[slot]]?.slot===slot);}
  function boundedInteger(value,lo,hi){return Number.isInteger(value)&&value>=lo&&value<=hi;}
  function repairRecord(build,setting,result,job,shift){return {jobId:job.id,kind:job.kind,title:job.title,day:job.day,route:job.route,shift,combinationId:result.combinationId,combinationName:result.combinationName,parts:{...build},setting,quality:result.quality};}
  function sanitizeProgress(value){
    const progress=freshProgress();
    if(!value||value.version!==VERSION||!boundedInteger(value.shift,1,LIMITS.shift))return progress;
    progress.shift=value.shift;
    function repair(record){
      if(!record||!KINDS.includes(record.kind)||!validBuild(record.parts)||!boundedInteger(record.setting,0,100)||!boundedInteger(record.day,1,Math.ceil(progress.shift/3)))return null;
      const shift=(record.day-1)*3+KINDS.indexOf(record.kind)+1;if(shift>progress.shift)return null;
      const job=jobAt(shift),result=evaluateBuild(record.parts,record.setting,job);if(!result.successful)return null;
      return repairRecord(record.parts,record.setting,result,job,shift);
    }
    const completed=new Map();
    for(const item of (Array.isArray(value.completedJobs)?value.completedJobs:[]).slice(-LIMITS.completedJobs)){const record=repair(item);if(record)completed.set(record.jobId,record);}
    progress.completedJobs=[...completed.values()].slice(-LIMITS.completedJobs);
    const best=new Map();
    for(const item of (Array.isArray(value.bestRepairs)?value.bestRepairs:[]).slice(0,LIMITS.bestRepairs)){const record=repair(item);if(record&&(!best.has(record.kind)||record.quality>best.get(record.kind).quality))best.set(record.kind,record);}
    progress.bestRepairs=[...best.values()].slice(0,LIMITS.bestRepairs);
    const discoveries=new Map();
    for(const item of (Array.isArray(value.discoveries)?value.discoveries:[]).slice(-LIMITS.discoveries)){
      if(!item||!validBuild(item.parts))continue;
      const id=combinationId(item.parts);discoveries.set(id,{id,name:combinationName(item.parts),parts:{...item.parts},firstShift:boundedInteger(item.firstShift,1,progress.shift)?item.firstShift:progress.shift,lastSetting:boundedInteger(item.lastSetting,0,100)?item.lastSetting:50});
    }
    progress.discoveries=[...discoveries.values()];return progress;
  }

  class StreamlinerEngine{
    constructor(options={}){
      this._listeners=new Set();this._build=emptyBuild();this._setting=50;this._result=null;this._notice='Fit one part in each socket, then test the charm.';
      this._storageKey=typeof options.storageKey==='string'&&options.storageKey?options.storageKey:DEFAULT_KEY;
      this._storage=null;this._storageStatus='memory-only';this._progress=freshProgress();
      try{this._storage=Object.prototype.hasOwnProperty.call(options,'storage')?options.storage:global.localStorage||null;if(this._storage&&typeof this._storage.getItem==='function'&&typeof this._storage.setItem==='function'){const raw=this._storage.getItem(this._storageKey);if(typeof raw==='string'&&raw.length<=100000)this._progress=sanitizeProgress(JSON.parse(raw));this._storageStatus='available';}else this._storage=null;}catch{this._storageStatus='memory-only';}
    }
    getState(){
      const activeJob=jobAt(this._progress.shift);activeJob.completed=this._progress.completedJobs.some(record=>record.jobId===activeJob.id);
      return clone({parts:PARTS,catalog:Object.fromEntries(SLOTS.map(slot=>[slot,PARTS.filter(part=>part.slot===slot)])),jobs:JOBS.map(({briefs,...job})=>job),activeJob,build:this._build,setting:this._setting,result:this._result,logbook:this._progress,notice:this._notice,storageStatus:this._storageStatus});
    }
    subscribe(listener){if(typeof listener!=='function')throw new TypeError('A subscriber must be a function.');this._listeners.add(listener);listener(this.getState());return ()=>this._listeners.delete(listener);}
    _save(){if(!this._storage)return;try{this._storage.setItem(this._storageKey,JSON.stringify({version:VERSION,...this._progress}));this._storageStatus='available';}catch{this._storageStatus='memory-only';}}
    _change(persist=false){if(persist)this._save();const state=this.getState();for(const listener of this._listeners){try{listener(clone(state));}catch{/* A view must not prevent the repair from being saved. */}}return state;}
    selectPart(slot,id){
      if(!SLOTS.includes(slot))throw new RangeError('Unknown assembly slot.');
      if(id!==null&&BY_ID[id]?.slot!==slot)throw new RangeError('That part belongs in a different slot.');
      this._build[slot]=id;this._result=null;
      const part=BY_ID[id],label={power:'Source',control:'Control',output:'Output'}[slot];
      this._notice=part?`${part.name} fitted. ${part.description} Test the charm to see its effect.`:`${label} socket cleared. Choose another ${label.toLowerCase()} from the drawer.`;
      return this._change();
    }
    setPower(value){const number=Number(value);if(!Number.isFinite(number))throw new TypeError('Energy must be a finite number.');this._setting=Math.round(clamp(number));this._result=null;this._notice='Energy changed. Test again to see the effect.';return this._change();}
    evaluate(){
      this._result=evaluateBuild(this._build,this._setting,jobAt(this._progress.shift));this._notice=this._result.diagnostic;
      if(this._result.complete){const id=this._result.combinationId,discovery=this._progress.discoveries.find(item=>item.id===id);if(discovery)discovery.lastSetting=this._setting;else this._progress.discoveries.push({id,name:this._result.combinationName,parts:{...this._build},firstShift:this._progress.shift,lastSetting:this._setting});this._progress.discoveries=this._progress.discoveries.slice(-LIMITS.discoveries);}
      return this._change(this._result.complete);
    }
    completeRepair(){
      const job=jobAt(this._progress.shift);
      if(this._progress.completedJobs.some(record=>record.jobId===job.id)){this._notice='This repair is already in the logbook. Take the next job when you are ready.';return this._change();}
      if(!this._result?.successful){this._notice='Test a complete circuit and meet the job’s checks before signing off.';return this._change();}
      const record=repairRecord(this._build,this._setting,this._result,job,this._progress.shift);
      this._progress.completedJobs.push(record);this._progress.completedJobs=this._progress.completedJobs.slice(-LIMITS.completedJobs);
      const previous=this._progress.bestRepairs.findIndex(item=>item.kind===job.kind);
      if(previous===-1)this._progress.bestRepairs.push(record);else if(record.quality>this._progress.bestRepairs[previous].quality)this._progress.bestRepairs[previous]=record;
      this._notice='Repair signed off. The carriage is ready, and your circuit is in the logbook.';return this._change(true);
    }
    nextJob(){
      if(!this.getState().activeJob.completed){this._notice='Finish this repair before taking the next job.';return this._change();}
      if(this._progress.shift>=LIMITS.shift){this._notice='This logbook is full. Reset progress to begin a fresh round.';return this._change();}
      this._progress.shift++;this._build=emptyBuild();this._setting=50;this._result=null;this._notice='A fresh slip from the conductor. The salvage drawer is ready.';return this._change(true);
    }
    resetBuild(){this._build=emptyBuild();this._setting=50;this._result=null;this._notice='Sockets clear. Your logbook is safe; try a new circuit.';return this._change();}
    resetProgress(){this._progress=freshProgress();this._build=emptyBuild();this._setting=50;this._result=null;this._notice='A fresh logbook. Welcome back to the first carriage.';try{this._storage?.removeItem?.(this._storageKey);}catch{this._storageStatus='memory-only';}return this._change(true);}
  }
  global.StreamlinerEngine=StreamlinerEngine;
})(typeof window!=='undefined'?window:globalThis);

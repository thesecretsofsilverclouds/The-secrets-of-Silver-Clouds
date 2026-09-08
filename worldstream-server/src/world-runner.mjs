/** A clock adapter, never a source of new world decisions or presentation calls. */
export function startWorldRunner(world,{now=Date.now,intervalMs=60_000,onError=()=>{},autoStart=true}={}) {
  let stopped=false;
  function tick() {
    if(stopped) return {processedActions:0,stopped:true};
    const target=Math.trunc(now());
    // Bound each transaction to six fictional hours for long offline catch-up.
    let watermark=world.operationalStats().resolvedThrough,processedActions=0;
    while(watermark<target) {
      const result=world.advance(Math.min(target,watermark+6*3_600_000));
      processedActions+=result.processedActions;watermark=result.resolvedThrough;
    }
    return {processedActions,resolvedThrough:watermark};
  }
  const run=()=>{try{return tick();}catch(error){onError(error);return null;}};
  let timer=null;
  if(autoStart) {run();timer=setInterval(run,Math.max(1000,intervalMs));timer.unref?.();}
  return {tick,stop(){stopped=true;if(timer)clearInterval(timer);}};
}

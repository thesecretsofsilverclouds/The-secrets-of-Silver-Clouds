import {openWorld,semanticDigest} from './world.mjs';
const options=JSON.parse(process.argv[2]);
const world=openWorld(options);
process.send({ready:true});
process.once('message',message=>{
  if(message!=='go') return;
  try {
    const runs=options.targets.map(target=>world.advance(target));
    const digest=semanticDigest(world.semanticSnapshot());
    world.close();process.send({done:true,digest,runs});process.disconnect();
  } catch(error) {world.close();process.send({error:error.message});process.exitCode=1;process.disconnect();}
});

import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createApp } from '../server.mjs';
import { openPinnedWorld } from '../src/world-operations.mjs';
import { startWorldRunner } from '../src/world-runner.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { openSocialStore } from '../src/social-store.mjs';
import { openFeedbackStore } from '../src/feedback-store.mjs';
import { openAudienceStore } from '../src/audience-store.mjs';
import { CinematicService,ViewerRegistry } from '../src/cinematic-service.mjs';
import { cinematicConfig,deterministicFallbackScene } from '../src/cinematics.mjs';
import { atLondon,londonDate,prevLondonDay } from '../src/time.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const directory=join(root,'data','worldstream-review-current');
// A day of history behind the world, not a fortnight. A first visitor should
// find the place already inhabited and mid-conversation — but a fortnight of
// seeded history burns two or three authored arcs into an archive nobody has
// read yet, and the library is finite and once-only. One day gives a full feed
// and leaves the stories ahead of them.
let firstDay=prevLondonDay(londonDate(Date.now()));
const world=openPinnedWorld({directory,...(!existsSync(join(directory,'world.sqlite'))?{startMs:atLondon(firstDay,'00:00')}:{})});
const runner=startWorldRunner(world,{onError:error=>console.error('World clock advance failed:',error.message)});
const socialStore=openSocialStore({dbPath:join(directory,'social.sqlite')});
const feedbackStore=openFeedbackStore({dbPath:join(directory,'feedback.sqlite')});
const cinematicStore=openCinematicStore({dbPath:join(directory,'cinematics.sqlite')});
const config={...cinematicConfig({}),enabled:false};
const viewers=new ViewerRegistry();
const audienceStore=openAudienceStore({dbPath:join(directory,'audience.sqlite'),ttlMs:viewers.ttlMs});
const service=new CinematicService({store:cinematicStore,client:null,config,getPresence:at=>viewers.snapshot(at)});
// Recent authored scenes can be replayed from the archive. Historical events
// never become live or trigger a provider call; the canonical ledger is untouched.
const indexed=service.ingest(world.presentationSnapshot(),{now:Date.now()});
for(const row of indexed.candidates.filter(row=>row.score>=40).slice(-8))
  cinematicStore.performCanonical(row.eventId,deterministicFallbackScene(row.packet,'authored_archive'),{now:Date.now(),minSceneGapMs:0});
const server=createApp({world,socialStore,feedbackStore,audienceStore,cinematicStore,cinematicService:service,viewerRegistry:viewers,
  cinematicClient:null,cinematicOptions:config});
let closed=false;
server.once('close',()=>{if(closed)return;closed=true;runner.stop();world.close();socialStore.close();feedbackStore.close();cinematicStore.close();audienceStore.close();});
server.once('error',error=>{console.error(error.message);runner.stop();world.close();socialStore.close();feedbackStore.close();cinematicStore.close();audienceStore.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
server.listen(4322,'127.0.0.1',()=>console.log('Worldstream review (current build): http://127.0.0.1:4322/ · saved London-clock world · authored scenes · model calls disabled'));

// Disposable UI verification: public snapshot only, separate in-memory votes.
// Never opens the saved world database or calls a model.
import { createApp } from '../server.mjs';
const response = await fetch('http://127.0.0.1:4322/api/world');
if (!response.ok) throw new Error('Start the saved-world preview first.');
const projection = await response.json();
const world = { advance() {}, publicProjection: () => structuredClone(projection) };
const server = createApp({ world, cinematicOptions: { enabled: false }, cinematicClient: null });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
server.listen(0, '127.0.0.1', () => console.log(`Disposable feedback check: http://127.0.0.1:${server.address().port}/ (test votes only)`));

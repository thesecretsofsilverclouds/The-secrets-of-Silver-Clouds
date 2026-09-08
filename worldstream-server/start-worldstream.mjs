// The explicit Worldstream launcher opts into live presentation if a key exists.
// A caller may still turn it off with WORLDSTREAM_CINEMATICS_ENABLED=false.
process.env.WORLDSTREAM_CINEMATICS_ENABLED ??= 'true';
const { startLocalServer } = await import('./server.mjs');
startLocalServer();

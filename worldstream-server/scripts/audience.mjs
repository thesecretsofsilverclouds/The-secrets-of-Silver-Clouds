import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAudienceSummary } from '../src/audience-store.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function formatAudienceSummary(summary) {
  return [
    `Worldstream private audience · ${new Date(summary.measuredAt).toLocaleString('en-GB', { timeZone: summary.timeZone })} London`,
    `Active browser sessions: ${summary.activeSessions}`,
    `Today's measured peak: ${summary.today.peakSessions} sessions`,
    `Today's session starts: ${summary.today.sessionStarts}`,
    '',
    'London day   Peak sessions   Session starts',
    ...summary.last7Days.map(day => `${day.date}   ${String(day.peakSessions).padStart(13)}   ${String(day.sessionStarts).padStart(14)}`),
    '',
    `These are browser sessions, not unique people. A session expires after ${summary.ttlMs / 1000}s without a heartbeat.`,
    'Your own tabs count. Reconnecting after expiry or a server restart starts a new session.',
    'No audience number is published by this tool.',
  ].join('\n');
}

function main(args) {
  let dbPath = join(root, 'data', 'worldstream-final-review-v21', 'audience.sqlite');
  let json = false;
  let watch = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) dbPath = resolve(args[++i]);
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--watch') watch = true;
    else if (args[i] === '--help') {
      console.log('Usage: node scripts/audience.mjs [--db PATH] [--json] [--watch]\nReads existing private audience measurements. --watch refreshes every 5 seconds.');
      return;
    } else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  function print() {
    const summary = readAudienceSummary({ dbPath });
    console.log(json ? JSON.stringify(summary) : formatAudienceSummary(summary));
  }
  print();
  if (watch) {
    const timer = setInterval(() => {
      try { print(); }
      catch (error) { console.error(error.message); clearInterval(timer); process.exitCode = 1; }
    }, 5000);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

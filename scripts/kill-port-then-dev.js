/**
 * PURPOSE: Clears any lingering processes on port 3001 before starting Next.js dev server.
 * USAGE: node scripts/kill-port-then-dev.js
 */
const { execSync } = require('child_process');
const { spawn } = require('child_process');

const PORT = 3001;

function getPortKilled() {
  try {
    const pids = execSync(`lsof -t -i:${PORT}`, { encoding: 'utf8' }).trim();
    if (pids) {
      pids.split('\n').forEach(pid => {
        try {
          process.kill(parseInt(pid, 10), 'SIGKILL');
        } catch (e) {
        }
      });
      console.log(`Killed existing process on port ${PORT}`);
      return true;
    }
  } catch (e) {
  }
  return false;
}

getPortKilled();

const next = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

next.on('close', (code) => {
  process.exit(code);
});

next.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  next.kill('SIGINT');
});
process.on('SIGTERM', () => {
  next.kill('SIGTERM');
});

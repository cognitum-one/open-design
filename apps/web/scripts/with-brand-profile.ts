import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const command = process.argv[2];
if (command !== 'dev' && command !== 'build') {
  throw new Error('Usage: node scripts/with-brand-profile.ts <dev|build>');
}

const source = await readFile(resolve('.env.cognitum-media-factory'), 'utf8');
const profile = Object.fromEntries(source
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`Invalid brand profile line: ${line}`);
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));

const next = resolve('node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [next, command, ...(command === 'dev' ? ['--turbopack'] : [])], {
  env: { ...process.env, ...profile },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}

child.once('error', (error) => {
  throw error;
});
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});

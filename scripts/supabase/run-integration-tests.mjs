import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const executable = resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
);
const status = spawnSync(executable, ['status', '--output', 'env'], {
  encoding: 'utf8',
});

if (status.status !== 0) {
  process.stderr.write(status.stderr);
  process.exit(status.status ?? 1);
}

const localEnvironment = Object.fromEntries(
  status.stdout
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2]]),
);
const required = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];
for (const name of required) {
  if (!localEnvironment[name]) {
    process.stderr.write(`Local Supabase status did not provide ${name}.\n`);
    process.exit(1);
  }
}

const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-concurrency=1',
    'supabase/tests/integration/identity-rest.test.mjs',
    'supabase/tests/integration/identity-concurrency.test.mjs',
  ],
  {
    env: { ...process.env, ...localEnvironment },
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);

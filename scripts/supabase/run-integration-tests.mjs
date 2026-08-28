import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

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

await waitForPostgrest(
  localEnvironment.API_URL,
  localEnvironment.SERVICE_ROLE_KEY,
);

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

async function waitForPostgrest(apiUrl, serviceRoleKey) {
  const deadline = Date.now() + 30_000;
  let lastFailure = 'no response';
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(
        `${apiUrl}/rest/v1/avatars?select=id&limit=1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          signal: globalThis.AbortSignal.timeout(2_000),
        },
      );
      // A 4xx proves PostgREST is connected; only server errors mean it is not
      // ready to execute the integration suite yet.
      if (response.status < 500) return;
      lastFailure = `HTTP ${String(response.status)}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Local PostgREST was not ready after 30s: ${lastFailure}`);
}

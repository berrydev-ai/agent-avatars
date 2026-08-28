import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const binary = resolve(root, 'node_modules/.bin/supabase');
const destination = resolve(root, 'src/lib/supabase/database.types.ts');
const generated = spawnSync(
  binary,
  ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
  { cwd: root, encoding: 'utf8' },
);

if (generated.status !== 0) {
  process.stderr.write(generated.stderr);
  process.exit(generated.status ?? 1);
}

const output = `${generated.stdout.trimEnd()}\n`;

if (process.argv.includes('--write')) {
  writeFileSync(destination, output, 'utf8');
  process.exit(0);
}

let committed;
try {
  committed = readFileSync(destination, 'utf8');
} catch {
  process.stderr.write(
    'Generated database types are missing. Run this script with --write.\n',
  );
  process.exit(1);
}

if (committed !== output) {
  process.stderr.write(
    'Generated database types are stale. Run this script with --write.\n',
  );
  process.exit(1);
}

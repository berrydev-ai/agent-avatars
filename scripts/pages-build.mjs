import { spawn } from 'node:child_process';
import process from 'node:process';

import {
  inspectPagesOutput,
  scanPagesOutputForSecrets,
  validateProductionEnvironment,
  validatePreviewEnvironment,
  writePagesHeaders,
} from './pages-config.mjs';

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

const environment =
  process.env.VITE_APP_ENV === 'production'
    ? validateProductionEnvironment(process.env)
    : validatePreviewEnvironment(process.env);
await run('npm', ['run', 'build'], environment);
await writePagesHeaders('dist', environment.VITE_SUPABASE_URL);
const summary = await inspectPagesOutput('dist');
await scanPagesOutputForSecrets('dist');

process.stdout.write(
  `Pages output validated: ${summary.fileCount} files; largest is ${summary.largest.relativePath} (${summary.largest.size} bytes)\n`,
);

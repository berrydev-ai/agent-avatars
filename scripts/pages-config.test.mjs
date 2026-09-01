import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  inspectPagesOutput,
  renderPagesHeaders,
  scanPagesOutputForSecrets,
  validateProductionEnvironment,
  validatePreviewEnvironment,
  validatePublishableKey,
} from './pages-config.mjs';

const execFileAsync = promisify(execFile);

const validEnvironment = {
  CF_PAGES: '1',
  CF_PAGES_BRANCH: `preview-${'a'.repeat(40)}`,
  CF_PAGES_COMMIT_SHA: 'a'.repeat(40),
  CF_PAGES_URL: `https://preview-${'a'.repeat(40)}.agent-avatars-preview.pages.dev`,
  VITE_APP_ENV: 'preview',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_value',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
};

const validProductionEnvironment = {
  CF_PAGES: '1',
  CF_PAGES_BRANCH: 'main',
  CF_PAGES_COMMIT_SHA: 'b'.repeat(40),
  VITE_APP_ENV: 'production',
  VITE_PUBLIC_SITE_URL: 'https://agent-avatars.dev',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_production_value',
  VITE_SUPABASE_URL: 'https://production.supabase.co',
};

test('normalizes an approved preview environment', () => {
  const actual = validatePreviewEnvironment(validEnvironment);
  assert.equal(actual.VITE_PUBLIC_SITE_URL, validEnvironment.CF_PAGES_URL);
  assert.equal(actual.VITE_SUPABASE_URL, 'https://example.supabase.co');
});

test('rejects production branches and non-Pages origins', () => {
  assert.throws(
    () =>
      validatePreviewEnvironment({
        ...validEnvironment,
        CF_PAGES_BRANCH: 'main',
      }),
    /non-production branch/,
  );
  assert.throws(
    () =>
      validatePreviewEnvironment({
        ...validEnvironment,
        CF_PAGES_URL: 'https://agent-avatars.dev',
      }),
    /pages\.dev preview origin/,
  );
});

test('accepts only the main production deployment context', () => {
  const actual = validateProductionEnvironment(validProductionEnvironment);
  assert.equal(actual.VITE_PUBLIC_SITE_URL, 'https://agent-avatars.dev');
  assert.equal(actual.VITE_SUPABASE_URL, 'https://production.supabase.co');

  assert.throws(
    () =>
      validateProductionEnvironment({
        ...validProductionEnvironment,
        CF_PAGES_BRANCH: 'feature/not-main',
      }),
    /CF_PAGES_BRANCH must be main/,
  );
  assert.throws(
    () =>
      validateProductionEnvironment({
        ...validProductionEnvironment,
        VITE_PUBLIC_SITE_URL: 'https://agent-avatars-d31.pages.dev',
      }),
    /VITE_PUBLIC_SITE_URL must be https:\/\/agent-avatars\.dev/,
  );
});

test('accepts only Supabase publishable or legacy anon keys', () => {
  const jwtForRole = (role) => {
    const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
    return `header.${payload}.signature`;
  };

  assert.doesNotThrow(() => validatePublishableKey('sb_publishable_test'));
  assert.doesNotThrow(() => validatePublishableKey(jwtForRole('anon')));
  assert.throws(
    () => validatePublishableKey(jwtForRole('service_role')),
    /publishable or legacy anon/,
  );
  assert.throws(
    () => validatePublishableKey(jwtForRole('authenticated')),
    /publishable or legacy anon/,
  );
  assert.throws(
    () => validatePublishableKey('sb_secret_not_public'),
    /publishable or legacy anon/,
  );
  assert.throws(() => validatePublishableKey('arbitrary-value'), /publishable/);
});

test('renders the required CSP and cache policy', () => {
  const headers = renderPagesHeaders('https://example.supabase.co');
  assert.match(
    headers,
    /connect-src 'self' https:\/\/example\.supabase\.co wss:\/\/example\.supabase\.co/,
  );
  assert.match(headers, /\/avatars\/\*\.svg[\s\S]*immutable/);
  assert.match(headers, /\/avatars\/manifest\.json[\s\S]*no-cache/);
  assert.doesNotMatch(headers, /unsafe-eval|\n\s+Strict-Transport-Security:/);
});

test('enforces file count, file size, index, and secret-marker gates', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages-config-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'index.html'), '<!doctype html>');
  await writeFile(path.join(directory, 'assets', 'app.js'), 'export {};');

  const summary = await inspectPagesOutput(directory, {
    fileLimit: 2,
    fileSizeLimit: 100,
  });
  assert.equal(summary.fileCount, 2);

  await writeFile(path.join(directory, 'extra.txt'), 'third');
  await assert.rejects(
    inspectPagesOutput(directory, { fileLimit: 2, fileSizeLimit: 100 }),
    /limit is 2/,
  );

  await rm(path.join(directory, 'extra.txt'));
  await writeFile(path.join(directory, 'assets', 'app.js'), 'x'.repeat(101));
  await assert.rejects(
    inspectPagesOutput(directory, { fileLimit: 2, fileSizeLimit: 100 }),
    /per-file limit is 100/,
  );

  await writeFile(
    path.join(directory, 'assets', 'app.js'),
    'CLOUDFLARE_API_TOKEN',
  );
  await assert.rejects(
    scanPagesOutputForSecrets(directory),
    /Potential secret marker/,
  );
});

test('build wrapper creates and validates deployable Pages output', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages-build-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { build: 'node build-fixture.mjs' },
    }),
  );
  await writeFile(
    path.join(directory, 'build-fixture.mjs'),
    "import { mkdir, writeFile } from 'node:fs/promises';\n" +
      "await mkdir('dist/avatars', { recursive: true });\n" +
      "await writeFile('dist/index.html', '<!doctype html>');\n" +
      "await writeFile('dist/avatars/manifest.json', '[]');\n",
  );

  const previewEnvironment = { ...process.env, ...validEnvironment };
  delete previewEnvironment.VITE_PUBLIC_SITE_URL;

  await execFileAsync(
    process.execPath,
    [path.resolve('scripts/pages-build.mjs')],
    {
      cwd: directory,
      env: previewEnvironment,
    },
  );

  const headers = await readFile(
    path.join(directory, 'dist', '_headers'),
    'utf8',
  );
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /https:\/\/example\.supabase\.co/);
});

test('build wrapper accepts the production deployment context', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages-production-build-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { build: 'node build-fixture.mjs' },
    }),
  );
  await writeFile(
    path.join(directory, 'build-fixture.mjs'),
    "import { mkdir, writeFile } from 'node:fs/promises';\n" +
      "await mkdir('dist/avatars', { recursive: true });\n" +
      "await writeFile('dist/index.html', '<!doctype html>');\n" +
      "await writeFile('dist/avatars/manifest.json', '[]');\n",
  );

  await execFileAsync(
    process.execPath,
    [path.resolve('scripts/pages-build.mjs')],
    {
      cwd: directory,
      env: { ...process.env, ...validProductionEnvironment },
    },
  );

  const headers = await readFile(
    path.join(directory, 'dist', '_headers'),
    'utf8',
  );
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /https:\/\/production\.supabase\.co/);
});

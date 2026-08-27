import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  inspectPagesOutput,
  renderPagesHeaders,
  scanPagesOutputForSecrets,
  validatePreviewEnvironment,
  validatePublishableKey,
} from './pages-config.mjs';

const validEnvironment = {
  CF_PAGES: '1',
  CF_PAGES_BRANCH: `preview-${'a'.repeat(40)}`,
  CF_PAGES_COMMIT_SHA: 'a'.repeat(40),
  CF_PAGES_URL: `https://preview-${'a'.repeat(40)}.agent-avatars-preview.pages.dev`,
  VITE_APP_ENV: 'preview',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_value',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
};

test('normalizes an approved preview environment', () => {
  const actual = validatePreviewEnvironment(validEnvironment);
  assert.equal(actual.VITE_PUBLIC_SITE_URL, validEnvironment.CF_PAGES_URL);
  assert.equal(actual.VITE_SUPABASE_URL, 'https://example.supabase.co');
});

test('rejects production branches and non-Pages origins', () => {
  assert.throws(
    () => validatePreviewEnvironment({ ...validEnvironment, CF_PAGES_BRANCH: 'main' }),
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

test('rejects a Supabase service-role key', () => {
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString(
    'base64url',
  );
  assert.throws(() => validatePublishableKey(`header.${payload}.signature`), /service-role/);
  assert.throws(() => validatePublishableKey('sb_secret_not_public'), /service-role/);
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

  await writeFile(path.join(directory, 'assets', 'app.js'), 'CLOUDFLARE_API_TOKEN');
  await assert.rejects(scanPagesOutputForSecrets(directory), /Potential secret marker/);
});

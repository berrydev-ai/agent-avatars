import { Buffer } from 'node:buffer';
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

export const CLOUDFLARE_FREE_FILE_LIMIT = 20_000;
export const CLOUDFLARE_FILE_SIZE_LIMIT = 25 * 1024 * 1024;

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const PRODUCTION_BRANCHES = new Set(['main', 'master', 'production']);
const SECRET_MARKERS = [
  /sb_secret_[A-Za-z0-9_-]+/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /SUPABASE_DB_PASSWORD/,
  /CLOUDFLARE_API_TOKEN/,
];

function parseOrigin(name, value, { allowLoopback = false } = {}) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }

  const loopback =
    allowLoopback &&
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

  if (parsed.protocol !== 'https:' && !loopback) {
    throw new Error(`${name} must use HTTPS`);
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${name} must be an origin without credentials, path, query, or hash`,
    );
  }

  return parsed;
}

function decodeJwtRole(value) {
  const segments = value.split('.');
  if (segments.length !== 3) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    );
    return typeof payload.role === 'string' ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

export function validatePublishableKey(value) {
  if (!value || /[\r\n]/.test(value)) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY is required and must be one line',
    );
  }

  const isPublishableKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(value);
  const isLegacyAnonKey = decodeJwtRole(value) === 'anon';
  if (!isPublishableKey && !isLegacyAnonKey) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key',
    );
  }
}

export function validatePreviewEnvironment(environment) {
  if (environment.CF_PAGES !== '1') {
    throw new Error('CF_PAGES must be 1 for a Pages preview build');
  }

  if (
    !environment.CF_PAGES_BRANCH ||
    PRODUCTION_BRANCHES.has(environment.CF_PAGES_BRANCH.toLowerCase())
  ) {
    throw new Error('CF_PAGES_BRANCH must identify a non-production branch');
  }

  if (!COMMIT_SHA_PATTERN.test(environment.CF_PAGES_COMMIT_SHA ?? '')) {
    throw new Error(
      'CF_PAGES_COMMIT_SHA must be a full lowercase Git commit SHA',
    );
  }

  const pagesUrl = parseOrigin('CF_PAGES_URL', environment.CF_PAGES_URL ?? '');
  if (!pagesUrl.hostname.endsWith('.pages.dev')) {
    throw new Error(
      'CF_PAGES_URL must use a Cloudflare pages.dev preview origin',
    );
  }

  if (environment.VITE_APP_ENV !== 'preview') {
    throw new Error('VITE_APP_ENV must be preview');
  }

  const siteUrl = environment.VITE_PUBLIC_SITE_URL
    ? parseOrigin('VITE_PUBLIC_SITE_URL', environment.VITE_PUBLIC_SITE_URL)
    : pagesUrl;

  if (siteUrl.origin !== pagesUrl.origin) {
    throw new Error(
      'VITE_PUBLIC_SITE_URL must match CF_PAGES_URL for preview builds',
    );
  }

  const supabaseUrl = parseOrigin(
    'VITE_SUPABASE_URL',
    environment.VITE_SUPABASE_URL ?? '',
  );
  validatePublishableKey(environment.VITE_SUPABASE_PUBLISHABLE_KEY ?? '');

  return {
    ...environment,
    VITE_PUBLIC_SITE_URL: siteUrl.origin,
    VITE_SUPABASE_URL: supabaseUrl.origin,
  };
}

export function renderPagesHeaders(supabaseOrigin) {
  const supabaseUrl = parseOrigin('VITE_SUPABASE_URL', supabaseOrigin);
  const websocketOrigin = new URL(supabaseUrl);
  websocketOrigin.protocol = 'wss:';

  return `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${supabaseUrl.origin} ${websocketOrigin.origin}; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()

/index.html
  Cache-Control: no-cache

/avatars/manifest.json
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/avatars/*.svg
  Cache-Control: public, max-age=31536000, immutable

/avatars/*.png
  Cache-Control: public, max-age=31536000, immutable

/avatars/*.jpg
  Cache-Control: public, max-age=31536000, immutable

/avatars/*.jpeg
  Cache-Control: public, max-age=31536000, immutable

/avatars/*.webp
  Cache-Control: public, max-age=31536000, immutable

/avatars/*.avif
  Cache-Control: public, max-age=31536000, immutable
`;
}

async function collectFiles(directory, relativeDirectory = '') {
  const entries = await readdir(path.join(directory, relativeDirectory), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(directory, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Unsupported build output entry: ${relativePath}`);
    }
  }

  return files;
}

export async function inspectPagesOutput(
  directory,
  {
    fileLimit = CLOUDFLARE_FREE_FILE_LIMIT,
    fileSizeLimit = CLOUDFLARE_FILE_SIZE_LIMIT,
  } = {},
) {
  const output = await lstat(directory);
  if (!output.isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }

  const files = await collectFiles(directory);
  if (!files.includes('index.html')) {
    throw new Error('Pages output must contain dist/index.html');
  }
  if (files.length > fileLimit) {
    throw new Error(
      `Pages output has ${files.length} files; limit is ${fileLimit}`,
    );
  }

  let largest = { relativePath: '', size: 0 };
  for (const relativePath of files) {
    const details = await stat(path.join(directory, relativePath));
    if (details.size > fileSizeLimit) {
      throw new Error(
        `${relativePath} is ${details.size} bytes; per-file limit is ${fileSizeLimit}`,
      );
    }
    if (details.size > largest.size) {
      largest = { relativePath, size: details.size };
    }
  }

  return { fileCount: files.length, largest };
}

export async function scanPagesOutputForSecrets(directory) {
  const files = await collectFiles(directory);

  for (const relativePath of files) {
    const absolutePath = path.join(directory, relativePath);
    const content = await readFile(absolutePath);
    const text = content.toString('utf8');
    if (SECRET_MARKERS.some((marker) => marker.test(text))) {
      throw new Error(`Potential secret marker found in ${relativePath}`);
    }
  }
}

export async function writePagesHeaders(directory, supabaseOrigin) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, '_headers'),
    renderPagesHeaders(supabaseOrigin),
    'utf8',
  );
}

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

const host = '127.0.0.1';
const port = 4173;
const baseURL = `http://${host}:${String(port)}`;
const desktopViewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };
const localSupabase = readLocalSupabaseEnvironment();
const supabaseUrl = requiredValue('PLAYWRIGHT_SUPABASE_URL', ['API_URL']);
const publishableKey = requiredValue('VITE_SUPABASE_PUBLISHABLE_KEY', [
  'PUBLISHABLE_KEY',
  'ANON_KEY',
]);
const secretKey = requiredValue('PLAYWRIGHT_SUPABASE_SECRET_KEY', [
  'SECRET_KEY',
  'SERVICE_ROLE_KEY',
]);
const mailpitUrl = requiredValue('PLAYWRIGHT_MAILPIT_URL', ['MAILPIT_URL']);

process.env.PLAYWRIGHT_BASE_URL ??= baseURL;
process.env.PLAYWRIGHT_SUPABASE_URL ??= supabaseUrl;
process.env.PLAYWRIGHT_SUPABASE_SECRET_KEY ??= secretKey;
process.env.PLAYWRIGHT_MAILPIT_URL ??= mailpitUrl;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: desktopViewport },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: desktopViewport },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: desktopViewport },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], viewport: mobileViewport },
    },
    {
      name: 'firefox-mobile',
      use: {
        ...devices['Desktop Firefox'],
        viewport: mobileViewport,
        hasTouch: true,
      },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'], viewport: mobileViewport },
    },
  ],
  webServer: {
    command: 'npm run build:app && npm run serve:e2e',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_APP_ENV: 'local',
      VITE_PUBLIC_SITE_URL: baseURL,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
  },
});

function readLocalSupabaseEnvironment(): Record<string, string> {
  const executable = resolve(
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
  );
  const output = execFileSync(executable, ['status', '--output', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => {
        const value = match[2] ?? '';
        return [
          match[1] ?? '',
          value.startsWith('"') ? (JSON.parse(value) as string) : value,
        ];
      }),
  );
}

function requiredValue(
  processName: string,
  localNames: readonly string[],
): string {
  const configured = process.env[processName];
  if (configured !== undefined && configured !== '') return configured;
  for (const name of localNames) {
    const value = localSupabase[name];
    if (value !== undefined && value !== '') return value;
  }
  throw new Error(
    `Missing ${processName}; local Supabase did not provide ${localNames.join(' or ')}`,
  );
}

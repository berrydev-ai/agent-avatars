import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { parseIdentityEnvironment } from './environment';

function jwtForRole(role: unknown): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  const signature = Buffer.from('test-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function jwtPayloadForRole(role: unknown): string {
  return jwtForRole(role).split('.')[1] ?? '';
}

const productionEnvironment = {
  VITE_APP_ENV: 'production',
  VITE_PUBLIC_SITE_URL: 'https://agent-avatars.dev',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
};

describe('identity environment', () => {
  it('accepts public local values without treating them as secrets', () => {
    expect(
      parseIdentityEnvironment({
        VITE_APP_ENV: 'local',
        VITE_PUBLIC_SITE_URL: 'http://127.0.0.1:5173',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test',
      }),
    ).toEqual({
      appEnv: 'local',
      publicSiteUrl: 'http://127.0.0.1:5173',
      supabaseUrl: 'http://127.0.0.1:54321',
      supabasePublishableKey: 'sb_publishable_local_test',
    });
  });

  it('requires HTTPS and origin-only URLs outside local development', () => {
    expect(() =>
      parseIdentityEnvironment({
        VITE_APP_ENV: 'production',
        VITE_PUBLIC_SITE_URL: 'http://agent-avatars.dev',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toThrow();
    expect(() =>
      parseIdentityEnvironment({
        VITE_APP_ENV: 'preview',
        VITE_PUBLIC_SITE_URL: 'https://preview.pages.dev/path',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toThrow();
  });

  it('rejects missing authenticated build values', () => {
    expect(() =>
      parseIdentityEnvironment({
        VITE_APP_ENV: 'production',
        VITE_PUBLIC_SITE_URL: 'https://agent-avatars.dev',
      }),
    ).toThrow();
  });

  it.each(['sb_publishable_test', jwtForRole('anon')])(
    'accepts supported browser credential %s',
    (acceptedKey) => {
      expect(() =>
        parseIdentityEnvironment({
          ...productionEnvironment,
          VITE_SUPABASE_PUBLISHABLE_KEY: acceptedKey,
        }),
      ).not.toThrow();
    },
  );

  it.each([
    ['missing', undefined],
    ['secret key', 'sb_secret_should-never-enter-a-browser'],
    ['service-role JWT', jwtForRole('service_role')],
    ['authenticated JWT', jwtForRole('authenticated')],
    ['non-string anon role JWT', jwtForRole(['anon'])],
    ['arbitrary value', 'arbitrary-value'],
    [
      'missing JWT signature',
      `${jwtForRole('anon').split('.').slice(0, 2).join('.')}.`,
    ],
    [
      'invalid JWT header',
      `not+base64url.${jwtPayloadForRole('anon')}.signature`,
    ],
    ['invalid JWT payload', 'header.!!!!.signature'],
    ['extra JWT segment', `${jwtForRole('anon')}.extra`],
  ])('rejects %s', (_credentialClass, rejectedKey) => {
    expect(() =>
      parseIdentityEnvironment({
        ...productionEnvironment,
        VITE_SUPABASE_PUBLISHABLE_KEY: rejectedKey,
      }),
    ).toThrow();
  });
});

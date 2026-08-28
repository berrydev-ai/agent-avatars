import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { parseIdentityEnvironment } from './environment';

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

  it('accepts only publishable or legacy anon browser keys', () => {
    const jwtForRole = (role: string) => {
      const payload = Buffer.from(JSON.stringify({ role })).toString(
        'base64url',
      );
      return `header.${payload}.signature`;
    };
    const input = {
      VITE_APP_ENV: 'production',
      VITE_PUBLIC_SITE_URL: 'https://agent-avatars.dev',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
    };

    expect(() =>
      parseIdentityEnvironment({
        ...input,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).not.toThrow();
    expect(() =>
      parseIdentityEnvironment({
        ...input,
        VITE_SUPABASE_PUBLISHABLE_KEY: jwtForRole('anon'),
      }),
    ).not.toThrow();

    for (const rejectedKey of [
      'sb_secret_should-never-enter-a-browser',
      jwtForRole('service_role'),
      jwtForRole('authenticated'),
      'arbitrary-value',
    ]) {
      expect(() =>
        parseIdentityEnvironment({
          ...input,
          VITE_SUPABASE_PUBLISHABLE_KEY: rejectedKey,
        }),
      ).toThrow();
    }
  });
});

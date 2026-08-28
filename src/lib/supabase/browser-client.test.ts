import { Buffer } from 'node:buffer';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn(() => ({})));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

import { createIdentityClients } from './browser-client';

function jwtForRole(role: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  const signature = Buffer.from('test-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function jwtPayloadForRole(role: string): string {
  return jwtForRole(role).split('.')[1] ?? '';
}

const storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

const environment = {
  VITE_APP_ENV: 'production',
  VITE_PUBLIC_SITE_URL: 'https://agent-avatars.dev',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
};

describe('browser identity client', () => {
  beforeEach(() => {
    createClient.mockClear();
  });

  it.each([
    'sb_secret_should-never-enter-a-browser',
    jwtForRole('service_role'),
    `header.${jwtPayloadForRole('anon')}.`,
    'malformed',
  ])('rejects %s before creating a provider client', (rejectedKey) => {
    expect(() =>
      createIdentityClients(
        {
          ...environment,
          VITE_SUPABASE_PUBLISHABLE_KEY: rejectedKey,
        },
        storage,
      ),
    ).toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(['sb_publishable_test', jwtForRole('anon')])(
    'creates a provider client for supported credential %s',
    (acceptedKey) => {
      createIdentityClients(
        {
          ...environment,
          VITE_SUPABASE_PUBLISHABLE_KEY: acceptedKey,
        },
        storage,
      );

      expect(createClient).toHaveBeenCalledOnce();
      expect(createClient).toHaveBeenCalledWith(
        environment.VITE_SUPABASE_URL,
        acceptedKey,
        expect.any(Object),
      );
    },
  );
});

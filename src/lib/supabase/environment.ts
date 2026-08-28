import { z } from 'zod';

import { validationError } from './errors';

export interface IdentityEnvironment {
  appEnv: 'local' | 'preview' | 'production';
  publicSiteUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export function parseIdentityEnvironment(
  input: Record<string, string | undefined>,
): IdentityEnvironment {
  try {
    const appEnv = z
      .enum(['local', 'preview', 'production'])
      .parse(input.VITE_APP_ENV);
    const publicSiteUrl = parseOrigin(
      input.VITE_PUBLIC_SITE_URL,
      appEnv === 'local',
    );
    const supabaseUrl = parseOrigin(
      input.VITE_SUPABASE_URL,
      appEnv === 'local',
    );
    const supabasePublishableKey = parseSupabaseBrowserKey(
      input.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    return { appEnv, publicSiteUrl, supabaseUrl, supabasePublishableKey };
  } catch (error) {
    throw validationError(error);
  }
}

function parseSupabaseBrowserKey(input: string | undefined): string {
  const value = z.string().trim().min(1).parse(input);
  const isPublishableKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(value);
  const isLegacyAnonKey = decodeJwtRole(value) === 'anon';
  if (!isPublishableKey && !isLegacyAnonKey) {
    throw new Error('publishable or legacy anon key required');
  }
  return value;
}

function decodeJwtRole(value: string): string | undefined {
  const segments = value.split('.');
  if (segments.length !== 3) return undefined;
  const payloadSegment = segments[1];
  if (payloadSegment === undefined) return undefined;
  try {
    const base64 = payloadSegment.replaceAll('-', '+').replaceAll('_', '/');
    const payload = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    ) as unknown;
    if (typeof payload !== 'object' || payload === null) return undefined;
    const role = (payload as { role?: unknown }).role;
    return typeof role === 'string' ? role : undefined;
  } catch {
    return undefined;
  }
}

function parseOrigin(
  input: string | undefined,
  allowLoopbackHttp: boolean,
): string {
  const raw = z.string().min(1).parse(input);
  const url = new URL(raw);
  const isLoopback =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';
  if (
    url.protocol !== 'https:' &&
    !(allowLoopbackHttp && isLoopback && url.protocol === 'http:')
  ) {
    throw new Error('https required');
  }
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    raw.endsWith('/')
  ) {
    throw new Error('origin required');
  }
  return raw;
}

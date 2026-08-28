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
  const isLegacyAnonKey = isLegacyJwtForRole(value, 'anon');
  if (!isPublishableKey && !isLegacyAnonKey) {
    throw new Error('publishable or legacy anon key required');
  }
  return value;
}

function isLegacyJwtForRole(value: string, expectedRole: string): boolean {
  const segments = value.split('.');
  if (segments.length !== 3) return false;
  const [headerSegment, payloadSegment, signatureSegment] = segments;
  if (
    headerSegment === undefined ||
    payloadSegment === undefined ||
    signatureSegment === undefined ||
    !isBase64UrlSegment(signatureSegment)
  )
    return false;

  const header = decodeJwtObject(headerSegment);
  const payload = decodeJwtObject(payloadSegment);
  return (
    typeof header?.alg === 'string' &&
    header.alg.length > 0 &&
    payload?.role === expectedRole
  );
}

function decodeJwtObject(segment: string): Record<string, unknown> | undefined {
  if (!isBase64UrlSegment(segment)) return undefined;
  try {
    const base64 = segment.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      Array.isArray(decoded)
    )
      return undefined;
    return decoded as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function isBase64UrlSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment.length % 4 !== 1 &&
    /^[A-Za-z0-9_-]+$/.test(segment)
  );
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

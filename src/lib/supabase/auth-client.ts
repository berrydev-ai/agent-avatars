import { z } from 'zod';

import type {
  AuthClient,
  AuthState,
  AuthUser,
  EmailPasswordInput,
} from '../contracts/identity';
import { mapProviderError, unexpectedResponse } from './errors';
import { parseEmailPassword, parseTokenHash } from './validation';

export interface GatewayResult<T> {
  data: T;
  error: unknown;
}

export interface AuthGateway {
  getSession(): Promise<GatewayResult<{ session: { user: unknown } | null }>>;
  subscribe(listener: (user: unknown, error?: Error) => void): () => void;
  signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<GatewayResult<{ user: unknown } | null>>;
  verifyEmail(
    tokenHash: string,
  ): Promise<GatewayResult<{ user: unknown } | null>>;
  signIn(
    input: EmailPasswordInput,
  ): Promise<GatewayResult<{ user: unknown } | null>>;
  signOut(): Promise<{ error: unknown }>;
}

const authUserSchema = z.object({ id: z.string().min(1), email: z.email() });
const deadSessionCodes = new Set([
  'session_not_found',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_expired',
]);

export function createAuthClient(
  gateway: AuthGateway,
  publicSiteUrl = 'http://127.0.0.1:5173',
): AuthClient {
  return {
    async getInitialState(): Promise<AuthState> {
      try {
        const result = await gateway.getSession();
        if (result.error !== null) {
          if (!isDeadSessionError(result.error)) {
            throw mapProviderError(result.error);
          }
          const cleanup = await gateway.signOut();
          if (cleanup.error !== null && !isDeadSessionError(cleanup.error)) {
            throw mapProviderError(cleanup.error);
          }
          return { status: 'anonymous' };
        }
        if (result.data.session === null) return { status: 'anonymous' };
        return {
          status: 'authenticated',
          user: parseAuthUser(result.data.session.user),
        };
      } catch (error) {
        return { status: 'error', error: mapProviderError(error) };
      }
    },

    subscribe(listener) {
      return gateway.subscribe((user, error) => {
        if (error !== undefined) {
          listener({ status: 'error', error: mapProviderError(error) });
          return;
        }
        if (user === null) {
          listener({ status: 'anonymous' });
          return;
        }
        try {
          listener({ status: 'authenticated', user: parseAuthUser(user) });
        } catch (parseError) {
          listener({ status: 'error', error: mapProviderError(parseError) });
        }
      });
    },

    async signUp(input) {
      const parsed = parseEmailPassword(input);
      const result = await gateway.signUp({
        ...parsed,
        emailRedirectTo: publicSiteUrl,
      });
      if (result.error !== null) throw mapProviderError(result.error);
      if (result.data === null) throw unexpectedResponse();
      return { status: 'confirmation_required', email: parsed.email };
    },

    async confirmEmail(input) {
      const result = await gateway.verifyEmail(parseTokenHash(input.tokenHash));
      return authenticatedResult(result);
    },

    async signIn(input) {
      const result = await gateway.signIn(parseEmailPassword(input));
      return authenticatedResult(result);
    },

    async signOut() {
      const result = await gateway.signOut();
      if (result.error !== null) throw mapProviderError(result.error);
    },
  };
}

function isDeadSessionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && deadSessionCodes.has(code);
}

function authenticatedResult(result: GatewayResult<{ user: unknown } | null>): {
  status: 'authenticated';
  user: AuthUser;
} {
  if (result.error !== null) throw mapProviderError(result.error);
  if (result.data === null) throw unexpectedResponse();
  return { status: 'authenticated', user: parseAuthUser(result.data.user) };
}

function parseAuthUser(user: unknown): AuthUser {
  const result = authUserSchema.safeParse(user);
  if (!result.success) throw unexpectedResponse(result.error);
  return result.data;
}

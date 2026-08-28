import { describe, expect, it, vi } from 'vitest';

import { AppClientError } from '../contracts/identity';
import { createAuthClient, type AuthGateway } from './auth-client';

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null }),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signUp: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@example.test' } },
      error: null,
    }),
    verifyEmail: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@example.test' } },
      error: null,
    }),
    signIn: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@example.test' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('auth client', () => {
  it('recovers anonymous and authenticated initial sessions', async () => {
    await expect(
      createAuthClient(createGateway()).getInitialState(),
    ).resolves.toEqual({
      status: 'anonymous',
    });

    const authenticated = createAuthClient(
      createGateway({
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-1', email: 'a@example.test' } },
          },
          error: null,
        }),
      }),
    );
    await expect(authenticated.getInitialState()).resolves.toEqual({
      status: 'authenticated',
      user: { id: 'user-1', email: 'a@example.test' },
    });
  });

  it.each([
    'session_not_found',
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_expired',
  ])('clears a stale %s session and starts anonymously', async (code) => {
    const gateway = createGateway({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { code, status: 400 },
      }),
    });

    await expect(createAuthClient(gateway).getInitialState()).resolves.toEqual({
      status: 'anonymous',
    });
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it('treats an already-cleared stale session as anonymous', async () => {
    const gateway = createGateway({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { code: 'refresh_token_not_found', status: 400 },
      }),
      signOut: vi.fn().mockResolvedValue({
        error: { code: 'session_not_found', status: 403 },
      }),
    });

    await expect(createAuthClient(gateway).getInitialState()).resolves.toEqual({
      status: 'anonymous',
    });
  });

  it.each([
    [
      'network response',
      vi.fn().mockResolvedValue({
        data: { session: null },
        error: new TypeError('provider unavailable'),
      }),
      'NETWORK_ERROR',
      true,
    ],
    [
      'network rejection',
      vi.fn().mockRejectedValue(new TypeError('provider unavailable')),
      'NETWORK_ERROR',
      true,
    ],
    [
      'provider response',
      vi.fn().mockResolvedValue({
        data: { session: null },
        error: { code: 'provider_failure', status: 503 },
      }),
      'UNEXPECTED_ERROR',
      false,
    ],
  ])(
    'keeps %s startup failures visible',
    async (_failureClass, getSession, code, retryable) => {
      const gateway = createGateway({ getSession });

      await expect(
        createAuthClient(gateway).getInitialState(),
      ).resolves.toMatchObject({
        status: 'error',
        error: { code, retryable },
      });
      expect(gateway.signOut).not.toHaveBeenCalled();
    },
  );

  it('keeps cleanup provider failures visible', async () => {
    const gateway = createGateway({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { code: 'session_expired', status: 400 },
      }),
      signOut: vi.fn().mockResolvedValue({
        error: { code: 'provider_failure', status: 503 },
      }),
    });

    await expect(
      createAuthClient(gateway).getInitialState(),
    ).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UNEXPECTED_ERROR', retryable: false },
    });
  });

  it('passes normalized signup input and the approved redirect', async () => {
    const gateway = createGateway();
    const client = createAuthClient(gateway, 'https://agent-avatars.dev');

    await expect(
      client.signUp({
        email: ' person@example.test ',
        password: 'a'.repeat(12),
      }),
    ).resolves.toEqual({
      status: 'confirmation_required',
      email: 'person@example.test',
    });
    expect(gateway.signUp).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'a'.repeat(12),
      emailRedirectTo: 'https://agent-avatars.dev',
    });
  });

  it('confirms token hashes and returns an authenticated user', async () => {
    const gateway = createGateway();
    const client = createAuthClient(gateway);

    await expect(
      client.confirmEmail({ tokenHash: 'one-time-hash', type: 'email' }),
    ).resolves.toEqual({
      status: 'authenticated',
      user: { id: 'user-1', email: 'a@example.test' },
    });
    expect(gateway.verifyEmail).toHaveBeenCalledWith('one-time-hash');
  });

  it('maps provider failures without exposing provider messages', async () => {
    const client = createAuthClient(
      createGateway({
        signIn: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'invalid_credentials',
            message: 'raw provider detail',
            status: 400,
          },
        }),
      }),
    );

    await expect(
      client.signIn({ email: 'a@example.test', password: 'a'.repeat(12) }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      retryable: false,
      message: 'The supplied value is invalid.',
    });
    await expect(
      client.signIn({ email: 'a@example.test', password: 'a'.repeat(12) }),
    ).rejects.toBeInstanceOf(AppClientError);
  });

  it('maps session events and delegates local sign-out', async () => {
    let emit: ((user: unknown, error?: Error) => void) | undefined;
    const unsubscribe = vi.fn();
    const gateway = createGateway({
      subscribe: vi.fn((listener: (user: unknown, error?: Error) => void) => {
        emit = listener;
        return unsubscribe;
      }),
    });
    const listener = vi.fn();
    const stop = createAuthClient(gateway).subscribe(listener);

    emit?.({ id: 'user-1', email: 'a@example.test' });
    emit?.(null);
    expect(listener).toHaveBeenNthCalledWith(1, {
      status: 'authenticated',
      user: { id: 'user-1', email: 'a@example.test' },
    });
    expect(listener).toHaveBeenNthCalledWith(2, { status: 'anonymous' });

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    await expect(createAuthClient(gateway).signOut()).resolves.toBeUndefined();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });
});

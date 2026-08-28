import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AuthState, IdentityClients } from '../../lib/supabase';
import { AccountControls } from './AccountControls';
import { IdentityProvider } from './IdentityProvider';
import { useIdentity } from './identity-context';

function createClients(
  authOverrides: Partial<IdentityClients['auth']> = {},
): IdentityClients {
  return {
    auth: {
      getInitialState: vi.fn().mockResolvedValue({ status: 'anonymous' }),
      subscribe: vi.fn().mockReturnValue(() => undefined),
      signUp: vi.fn().mockResolvedValue({
        status: 'confirmation_required',
        email: 'person@example.test',
      }),
      confirmEmail: vi.fn().mockResolvedValue({
        status: 'authenticated',
        user: { id: 'user-1', email: 'person@example.test' },
      }),
      signIn: vi.fn().mockResolvedValue({
        status: 'authenticated',
        user: { id: 'user-1', email: 'person@example.test' },
      }),
      signOut: vi.fn().mockResolvedValue(undefined),
      ...authOverrides,
    },
    favorites: {
      listFavorites: vi.fn().mockResolvedValue([]),
      setFavorite: vi.fn().mockResolvedValue(true),
    },
    teams: {
      listTeams: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      createTeam: vi.fn(),
      renameTeam: vi.fn(),
      deleteTeam: vi.fn(),
      setMembers: vi.fn(),
    },
  };
}

function AuthProbe({ onState }: { onState?: (state: AuthState) => void }) {
  const { auth } = useIdentity();
  useEffect(() => onState?.(auth), [auth, onState]);
  return <p>Auth state: {auth.status}</p>;
}

describe('IdentityProvider', () => {
  it('restores a session without blocking children and accepts later auth events', async () => {
    let emit: ((state: AuthState) => void) | undefined;
    const clients = createClients({
      getInitialState: vi.fn().mockResolvedValue({
        status: 'authenticated',
        user: { id: 'user-1', email: 'person@example.test' },
      }),
      subscribe: vi.fn((listener: (state: AuthState) => void) => {
        emit = listener;
        return () => undefined;
      }),
    });

    render(
      <IdentityProvider clients={clients}>
        <p>Public catalog</p>
        <AuthProbe />
      </IdentityProvider>,
    );

    expect(screen.getByText('Public catalog')).toBeInTheDocument();
    expect(screen.getByText('Auth state: loading')).toBeInTheDocument();
    await screen.findByText('Auth state: authenticated');

    act(() => emit?.({ status: 'anonymous' }));
    expect(screen.getByText('Auth state: anonymous')).toBeInTheDocument();
  });

  it('does not let a slow startup lookup overwrite a newer auth event', async () => {
    let resolveInitial: ((state: AuthState) => void) | undefined;
    let emit: ((state: AuthState) => void) | undefined;
    const clients = createClients({
      getInitialState: vi.fn(
        () =>
          new Promise<AuthState>((resolve) => {
            resolveInitial = resolve;
          }),
      ),
      subscribe: vi.fn((listener: (state: AuthState) => void) => {
        emit = listener;
        return () => undefined;
      }),
    });

    render(
      <IdentityProvider clients={clients}>
        <AuthProbe />
      </IdentityProvider>,
    );

    act(() =>
      emit?.({
        status: 'authenticated',
        user: { id: 'user-1', email: 'person@example.test' },
      }),
    );
    expect(screen.getByText('Auth state: authenticated')).toBeInTheDocument();

    act(() => resolveInitial?.({ status: 'anonymous' }));
    await waitFor(() =>
      expect(screen.getByText('Auth state: authenticated')).toBeInTheDocument(),
    );
  });

  it('removes the email credential from the URL before confirming it', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/confirm#token_hash=one-time-hash&type=email',
    );
    const confirmEmail = vi.fn().mockImplementation(() => {
      expect(window.location.hash).toBe('');
      return Promise.resolve({
        status: 'authenticated' as const,
        user: { id: 'user-1', email: 'person@example.test' },
      });
    });
    const clients = createClients({ confirmEmail });

    render(
      <IdentityProvider clients={clients}>
        <AuthProbe />
      </IdentityProvider>,
    );

    await screen.findByText('Auth state: authenticated');
    expect(confirmEmail).toHaveBeenCalledWith({
      tokenHash: 'one-time-hash',
      type: 'email',
    });
    expect(window.location.hash).toBe('');
  });
});

describe('AccountControls', () => {
  it('signs in and signs out while keeping account errors locally authored', async () => {
    const user = userEvent.setup();
    const clients = createClients();

    render(
      <IdentityProvider clients={clients}>
        <AccountControls />
        <AuthProbe />
      </IdentityProvider>,
    );
    await screen.findByText('Auth state: anonymous');

    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await user.type(
      screen.getByRole('textbox', { name: /email/i }),
      'person@example.test',
    );
    await user.type(screen.getByLabelText(/^password$/i), 'a'.repeat(12));
    const submit = within(screen.getByRole('dialog'))
      .getAllByRole('button', { name: /^sign in$/i })
      .at(-1);
    if (!submit) throw new Error('Expected a sign-in submit button.');
    await user.click(submit);

    await screen.findByText('person@example.test');
    expect(screen.getByText('Auth state: authenticated')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await screen.findByText('Auth state: anonymous');
    expect(clients.auth.signOut).toHaveBeenCalledOnce();
  });
});

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  AppClientError,
  type AuthState,
  type IdentityClients,
} from '../../lib/supabase';
import { IdentityContext, type IdentityContextValue } from './identity-context';

export function IdentityProvider({
  clients,
  children,
}: {
  clients: IdentityClients | null;
  children: ReactNode;
}) {
  const [auth, setAuth] = useState<AuthState>(
    clients === null ? { status: 'anonymous' } : { status: 'loading' },
  );

  useEffect(() => {
    if (clients === null) {
      return;
    }

    let active = true;
    let receivedEvent = false;
    const stop = clients.auth.subscribe((nextState) => {
      receivedEvent = true;
      if (active) setAuth(nextState);
    });
    const confirmation = consumeConfirmationFragment();

    if (confirmation.status === 'valid') {
      void clients.auth
        .confirmEmail({ tokenHash: confirmation.tokenHash, type: 'email' })
        .then((nextState) => {
          if (active) setAuth(nextState);
        })
        .catch((error: unknown) => {
          if (active) setAuth({ status: 'error', error: toClientError(error) });
        });
    } else if (confirmation.status === 'invalid') {
      void Promise.resolve().then(() => {
        if (active) {
          setAuth({
            status: 'error',
            error: new AppClientError('VALIDATION_ERROR', false),
          });
        }
      });
    } else {
      void clients.auth.getInitialState().then((initialState) => {
        if (active && !receivedEvent) setAuth(initialState);
      });
    }

    return () => {
      active = false;
      stop();
    };
  }, [clients]);

  const value = useMemo<IdentityContextValue>(
    () => ({
      available: clients !== null,
      auth: clients === null ? { status: 'anonymous' } : auth,
      clients,
      async signIn(input) {
        if (clients === null) throw new AppClientError('NETWORK_ERROR', true);
        const nextState = await clients.auth.signIn(input);
        setAuth(nextState);
      },
      async signUp(input) {
        if (clients === null) throw new AppClientError('NETWORK_ERROR', true);
        return clients.auth.signUp(input);
      },
      async signOut() {
        if (clients === null) return;
        await clients.auth.signOut();
        setAuth({ status: 'anonymous' });
      },
    }),
    [auth, clients],
  );

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

type ConfirmationFragment =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'valid'; tokenHash: string };

function consumeConfirmationFragment(): ConfirmationFragment {
  if (window.location.pathname !== '/auth/confirm') return { status: 'none' };

  const rawHash = window.location.hash;
  if (rawHash === '') return { status: 'none' };
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
  const params = new URLSearchParams(rawHash.replace(/^#/, ''));
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (
    tokenHash === null ||
    tokenHash.trim() === '' ||
    type !== 'email' ||
    [...params.keys()].some((key) => key !== 'token_hash' && key !== 'type')
  ) {
    return { status: 'invalid' };
  }
  return { status: 'valid', tokenHash };
}

function toClientError(error: unknown): AppClientError {
  return error instanceof AppClientError
    ? error
    : new AppClientError('UNEXPECTED_ERROR', false, error);
}

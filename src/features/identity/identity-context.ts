import { createContext, useContext } from 'react';

import type {
  EmailPasswordInput,
  SignUpResult,
} from '../../lib/contracts/identity';
import type { AuthState, IdentityClients } from '../../lib/supabase';

export interface IdentityContextValue {
  available: boolean;
  auth: AuthState;
  clients: IdentityClients | null;
  signIn(input: EmailPasswordInput): Promise<void>;
  signUp(input: EmailPasswordInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
}

export const IdentityContext = createContext<IdentityContextValue | null>(null);

export function useIdentity(): IdentityContextValue {
  const value = useOptionalIdentity();
  if (value === null) {
    throw new Error('useIdentity must be used within IdentityProvider.');
  }
  return value;
}

export function useOptionalIdentity(): IdentityContextValue | null {
  return useContext(IdentityContext);
}

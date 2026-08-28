import { createClient, type SupportedStorage } from '@supabase/supabase-js';

import type {
  AuthClient,
  FavoriteClient,
  TeamClient,
} from '../contracts/identity';
import { createAuthClient } from './auth-client';
import { createFavoriteClient, createTeamClient } from './data-client';
import { parseIdentityEnvironment } from './environment';
import {
  createSupabaseAuthGateway,
  createSupabaseDataGateway,
} from './supabase-gateway';
import type { Database } from './database.types';

export interface IdentityClients {
  auth: AuthClient;
  favorites: FavoriteClient;
  teams: TeamClient;
}

export function createIdentityClients(
  input: Record<string, string | undefined>,
  storage: SupportedStorage,
): IdentityClients {
  const environment = parseIdentityEnvironment(input);
  const provider = createClient<Database>(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage,
      },
    },
  );
  const dataGateway = createSupabaseDataGateway(provider);
  return {
    auth: createAuthClient(
      createSupabaseAuthGateway(provider),
      environment.publicSiteUrl,
    ),
    favorites: createFavoriteClient(dataGateway),
    teams: createTeamClient(dataGateway),
  };
}

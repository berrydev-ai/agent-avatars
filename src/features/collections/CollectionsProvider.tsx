import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { IdentityClients } from '../../lib/supabase';
import { useOptionalIdentity } from '../identity/identity-context';
import {
  CollectionsContext,
  type CollectionsContextValue,
} from './collections-context';
import { useTeams } from './useTeams';

const anonymousCollections: CollectionsContextValue = {
  authenticated: false,
  favoriteStatus: 'anonymous',
  favoriteIds: new Set(),
  busyFavoriteIds: new Set(),
  message: '',
  toggleFavorite: () => Promise.resolve(),
  teamStatus: 'error',
  teams: [],
  selectedTeamId: null,
  nextTeamCursor: null,
  busyTeamIds: new Set(),
  teamMessage: '',
  selectTeam: () => undefined,
  createTeam: () => Promise.resolve(false),
  renameTeam: () => Promise.resolve(false),
  deleteTeam: () => Promise.resolve(false),
  updateTeamMembers: () => Promise.resolve(false),
  loadMoreTeams: () => Promise.resolve(),
};

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const identity = useOptionalIdentity();
  if (identity?.auth.status !== 'authenticated' || identity.clients === null) {
    return (
      <CollectionsContext.Provider value={anonymousCollections}>
        {children}
      </CollectionsContext.Provider>
    );
  }

  return (
    <AuthenticatedCollections
      key={identity.auth.user.id}
      clients={identity.clients}
    >
      {children}
    </AuthenticatedCollections>
  );
}

function AuthenticatedCollections({
  clients,
  children,
}: {
  clients: IdentityClients;
  children: ReactNode;
}) {
  const [favoriteStatus, setFavoriteStatus] =
    useState<CollectionsContextValue['favoriteStatus']>('loading');
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [busyFavoriteIds, setBusyFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [message, setMessage] = useState('');
  const teamCollections = useTeams(clients.teams);

  useEffect(() => {
    let active = true;
    void clients.favorites
      .listFavorites()
      .then((favorites) => {
        if (!active) return;
        setFavoriteIds(new Set(favorites.map(({ avatarId }) => avatarId)));
        setFavoriteStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setFavoriteStatus('error');
        setMessage('Saved avatars could not be loaded. Try again shortly.');
      });
    return () => {
      active = false;
    };
  }, [clients]);

  const value = useMemo<CollectionsContextValue>(
    () => ({
      authenticated: true,
      favoriteStatus,
      favoriteIds,
      busyFavoriteIds,
      message,
      ...teamCollections,
      async toggleFavorite(avatarId, label) {
        if (favoriteStatus !== 'ready' || busyFavoriteIds.has(avatarId)) return;
        const wasFavorite = favoriteIds.has(avatarId);
        const desiredState = !wasFavorite;
        setFavoriteIds(updateSet(avatarId, desiredState));
        setBusyFavoriteIds(updateSet(avatarId, true));
        setMessage('');
        try {
          const storedState = await clients.favorites.setFavorite(
            avatarId,
            desiredState,
          );
          setFavoriteIds(updateSet(avatarId, storedState));
          setMessage(
            storedState
              ? `Saved ${label} to favorites.`
              : `Removed ${label} from favorites.`,
          );
        } catch {
          setFavoriteIds(updateSet(avatarId, wasFavorite));
          setMessage(
            wasFavorite
              ? `Could not remove ${label} from favorites. Your saved copy is unchanged.`
              : `Could not save ${label} to favorites. Try again.`,
          );
        } finally {
          setBusyFavoriteIds(updateSet(avatarId, false));
        }
      },
    }),
    [
      busyFavoriteIds,
      clients.favorites,
      favoriteIds,
      favoriteStatus,
      message,
      teamCollections,
    ],
  );

  return (
    <CollectionsContext.Provider value={value}>
      {children}
    </CollectionsContext.Provider>
  );
}

function updateSet(
  value: string,
  present: boolean,
): (current: ReadonlySet<string>) => ReadonlySet<string> {
  return (current) => {
    const next = new Set(current);
    if (present) next.add(value);
    else next.delete(value);
    return next;
  };
}

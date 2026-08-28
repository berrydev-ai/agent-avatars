import { createContext, useContext } from 'react';
import type { TeamCollections } from './useTeams';

export interface CollectionsContextValue extends TeamCollections {
  authenticated: boolean;
  favoriteStatus: 'anonymous' | 'loading' | 'ready' | 'error';
  favoriteIds: ReadonlySet<string>;
  busyFavoriteIds: ReadonlySet<string>;
  message: string;
  toggleFavorite(avatarId: string, label: string): Promise<void>;
}

export const CollectionsContext = createContext<CollectionsContextValue | null>(
  null,
);

export function useOptionalCollections(): CollectionsContextValue | null {
  return useContext(CollectionsContext);
}

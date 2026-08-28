import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AvatarManifest, AvatarRecord } from '../../lib/contracts/avatar';
import { AppClientError, type IdentityClients } from '../../lib/supabase';
import { CatalogPage } from '../catalog/CatalogPage';
import { IdentityProvider } from '../identity/IdentityProvider';
import { CollectionsProvider } from './CollectionsProvider';

const manifest: AvatarManifest = {
  schemaVersion: 1,
  generators: [],
  rights: [],
  provenance: [],
  tagDefinitions: [],
  avatars: [
    avatar('dicebear-aaaaaaaaaaaaaaaaaaaa', 'lorelei'),
    avatar('dicebear-bbbbbbbbbbbbbbbbbbbb', 'notionists'),
  ],
};

function createClients(
  favoriteOverrides: Partial<IdentityClients['favorites']> = {},
): IdentityClients {
  return {
    auth: {
      getInitialState: vi.fn().mockResolvedValue({
        status: 'authenticated',
        user: { id: 'user-1', email: 'person@example.test' },
      }),
      subscribe: vi.fn().mockReturnValue(() => undefined),
      signUp: vi.fn(),
      confirmEmail: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    favorites: {
      listFavorites: vi.fn().mockResolvedValue([]),
      setFavorite: vi.fn().mockResolvedValue(true),
      ...favoriteOverrides,
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

function renderCatalog(clients: IdentityClients) {
  return render(
    <IdentityProvider clients={clients}>
      <CollectionsProvider>
        <CatalogPage
          manifest={manifest}
          publicSiteOrigin="https://agent-avatars.dev"
        />
      </CollectionsProvider>
    </IdentityProvider>,
  );
}

describe('catalog favorites', () => {
  it('restores a favorites-only URL and renders exactly the saved avatars', async () => {
    window.history.replaceState({}, '', '/?view=favorites');
    const clients = createClients({
      listFavorites: vi.fn().mockResolvedValue([
        {
          avatarId: 'dicebear-bbbbbbbbbbbbbbbbbbbb',
          availability: 'active',
        },
      ]),
    });

    renderCatalog(clients);

    expect(
      await screen.findByRole('button', { name: /saved avatars/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('1 avatar')).toBeInTheDocument();
    expect(screen.getByText('Notionists')).toBeInTheDocument();
    expect(screen.queryByText('Lorelei')).not.toBeInTheDocument();
  });

  it('optimistically favorites and visibly rolls back a failed update', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/');
    let rejectUpdate: ((error: Error) => void) | undefined;
    const clients = createClients({
      setFavorite: vi.fn(
        () =>
          new Promise<boolean>((_resolve, reject) => {
            rejectUpdate = reject;
          }),
      ),
    });
    renderCatalog(clients);

    const save = await screen.findByRole('button', {
      name: /save lorelei to favorites/i,
    });
    await user.click(save);
    expect(
      screen.getByRole('button', {
        name: /remove lorelei from favorites/i,
      }),
    ).toBeInTheDocument();

    act(() => rejectUpdate?.(new AppClientError('NETWORK_ERROR', true)));

    expect(
      await screen.findByRole('button', {
        name: /save lorelei to favorites/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('alert', { name: /collection update/i }),
    ).toHaveTextContent(/could not save lorelei/i);
  });
});

function avatar(id: string, preset: string): AvatarRecord {
  return {
    id,
    generatorId: 'dicebear',
    preset,
    assetPath: `/avatars/${id}.svg`,
    assetExtension: 'svg',
    mediaType: 'image/svg+xml',
    assetSha256: id.slice(-20).padEnd(64, '0'),
    width: 256,
    height: 256,
    alt: `${preset} illustrated agent`,
    tags: [],
    rightsId: 'dicebear-cc0-1-0',
    provenanceId: `dicebear-provenance-${id.slice(-20)}`,
  };
}

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AgentTeam } from '../../lib/contracts/identity';
import type {
  AvatarManifest as CatalogManifest,
  AvatarRecord,
} from '../../lib/contracts/avatar';
import { AppClientError, type IdentityClients } from '../../lib/supabase';
import { CatalogPage } from '../catalog/CatalogPage';
import { IdentityProvider } from '../identity/IdentityProvider';
import { CollectionsProvider } from './CollectionsProvider';

const avatarA = avatar('dicebear-aaaaaaaaaaaaaaaaaaaa', 'lorelei');
const avatarB = avatar('dicebear-bbbbbbbbbbbbbbbbbbbb', 'notionists');
const manifest: CatalogManifest = {
  schemaVersion: 1,
  generators: [],
  rights: [],
  provenance: [],
  tagDefinitions: [],
  avatars: [avatarA, avatarB],
};

const alpha: AgentTeam = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Alpha',
  avatars: [],
  createdAt: '2026-08-28T12:00:00.000Z',
  updatedAt: '2026-08-28T12:00:00.000Z',
};

function createClients(
  teamOverrides: Partial<IdentityClients['teams']> = {},
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
      setFavorite: vi.fn(),
    },
    teams: {
      listTeams: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      createTeam: vi.fn().mockResolvedValue(alpha),
      renameTeam: vi
        .fn()
        .mockImplementation(({ name }: { name: string }) =>
          Promise.resolve({ ...alpha, name }),
        ),
      deleteTeam: vi.fn().mockResolvedValue(undefined),
      setMembers: vi.fn(({ avatarIds }: { avatarIds: readonly string[] }) =>
        Promise.resolve({
          ...alpha,
          avatars: avatarIds.map((avatarId) => ({
            avatarId: avatarId as AgentTeam['avatars'][number]['avatarId'],
            availability: 'active' as const,
          })),
        }),
      ),
      ...teamOverrides,
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

describe('Agent Teams editor', () => {
  it('creates, renames, and confirm-deletes a team from an explicit empty state', async () => {
    const user = userEvent.setup();
    const clients = createClients();
    renderCatalog(clients);

    await user.click(
      await screen.findByRole('button', { name: /agent teams/i }),
    );
    expect(screen.getByText(/no agent teams yet/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/new team name/i), 'Alpha');
    await user.click(screen.getByRole('button', { name: /create team/i }));
    expect(
      await screen.findByRole('heading', { name: 'Alpha' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /add lorelei to alpha/i }),
    );
    expect(clients.teams.setMembers).toHaveBeenCalledWith({
      teamId: alpha.id,
      avatarIds: [avatarA.id],
    });

    const rename = screen.getByLabelText(/rename alpha/i);
    await user.clear(rename);
    await user.type(rename, 'Beta');
    await user.click(screen.getByRole('button', { name: /save team name/i }));
    expect(
      await screen.findByRole('heading', { name: 'Beta' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete beta/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete beta/i }));
    await user.click(
      screen.getByRole('button', { name: /confirm delete beta/i }),
    );
    expect(await screen.findByText(/no agent teams yet/i)).toBeInTheDocument();
    expect(clients.teams.deleteTeam).toHaveBeenCalledWith(alpha.id);
  });

  it('adds from the catalog, reorders members, and rolls back a failed removal', async () => {
    const user = userEvent.setup();
    const populated: AgentTeam = {
      ...alpha,
      avatars: [
        {
          avatarId: avatarA.id as AgentTeam['avatars'][number]['avatarId'],
          availability: 'active',
        },
        {
          avatarId: avatarB.id as AgentTeam['avatars'][number]['avatarId'],
          availability: 'active',
        },
      ],
    };
    let rejectRemoval: ((error: Error) => void) | undefined;
    const setMembers = vi
      .fn()
      .mockResolvedValueOnce({
        ...populated,
        avatars: [populated.avatars[1], populated.avatars[0]],
      })
      .mockImplementationOnce(
        () =>
          new Promise<AgentTeam>((_resolve, reject) => {
            rejectRemoval = reject;
          }),
      );
    const clients = createClients({
      listTeams: vi
        .fn()
        .mockResolvedValue({ items: [populated], nextCursor: null }),
      setMembers,
    });
    renderCatalog(clients);

    await user.click(
      await screen.findByRole('button', { name: /agent teams/i }),
    );
    const members = await screen.findByRole('list', {
      name: /members of alpha/i,
    });
    await user.click(
      within(members).getByRole('button', { name: /move lorelei down/i }),
    );
    expect(setMembers).toHaveBeenNthCalledWith(1, {
      teamId: alpha.id,
      avatarIds: [avatarB.id, avatarA.id],
    });
    expect(within(members).getAllByRole('listitem')[0]).toHaveTextContent(
      'Notionists',
    );

    await user.click(
      within(members).getByRole('button', { name: /remove notionists/i }),
    );
    expect(within(members).queryByText('Notionists')).not.toBeInTheDocument();
    act(() => rejectRemoval?.(new AppClientError('NETWORK_ERROR', true)));

    expect(await within(members).findByText('Notionists')).toBeInTheDocument();
    expect(
      screen.getByRole('alert', { name: /team update/i }),
    ).toHaveTextContent(/could not update alpha/i);
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

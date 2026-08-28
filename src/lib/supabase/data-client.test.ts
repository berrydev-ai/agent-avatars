import { describe, expect, it, vi } from 'vitest';

import {
  createFavoriteClient,
  createTeamClient,
  type IdentityDataGateway,
} from './data-client';

function result(data: unknown) {
  return Promise.resolve({ data, error: null });
}

function createGateway(
  overrides: Partial<IdentityDataGateway> = {},
): IdentityDataGateway {
  return {
    listFavorites: vi.fn().mockReturnValue(
      result([
        {
          avatar_id: 'test-aaaaaaaaaaaaaaaaaaaa',
          avatars: { publication_status: 'active' },
        },
      ]),
    ),
    setFavorite: vi.fn().mockReturnValue(result(true)),
    listTeams: vi.fn().mockReturnValue(result([])),
    listMembers: vi.fn().mockReturnValue(result([])),
    createTeam: vi.fn().mockReturnValue(result(null)),
    renameTeam: vi.fn().mockReturnValue(result(null)),
    deleteTeam: vi.fn().mockReturnValue(result(true)),
    setMembers: vi.fn().mockReturnValue(result([])),
    getTeam: vi.fn().mockReturnValue(result(null)),
    ...overrides,
  };
}

const teamOne = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Alpha',
  created_at: '2026-08-27T19:00:00.000Z',
  updated_at: '2026-08-27T20:00:00.000Z',
};

describe('favorite client', () => {
  it('lists saved references and makes set/clear retry safe', async () => {
    const gateway = createGateway();
    const client = createFavoriteClient(gateway);

    await expect(client.listFavorites()).resolves.toEqual([
      { avatarId: 'test-aaaaaaaaaaaaaaaaaaaa', availability: 'active' },
    ]);
    await expect(
      client.setFavorite('test-aaaaaaaaaaaaaaaaaaaa', true),
    ).resolves.toBe(true);
    await expect(
      client.setFavorite('test-aaaaaaaaaaaaaaaaaaaa', false),
    ).resolves.toBe(true);
  });
});

describe('team client', () => {
  it('paginates with a stable opaque cursor and preserves member order', async () => {
    const teamTwo = {
      ...teamOne,
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Beta',
      updated_at: '2026-08-27T19:30:00.000Z',
    };
    const gateway = createGateway({
      listTeams: vi.fn().mockReturnValue(result([teamOne, teamTwo])),
      listMembers: vi.fn().mockReturnValue(
        result([
          {
            team_id: teamOne.id,
            avatar_id: 'test-bbbbbbbbbbbbbbbbbbbb',
            position: 0,
            avatars: { publication_status: 'withdrawn' },
          },
          {
            team_id: teamOne.id,
            avatar_id: 'test-aaaaaaaaaaaaaaaaaaaa',
            position: 1,
            avatars: { publication_status: 'active' },
          },
        ]),
      ),
    });

    const page = await createTeamClient(gateway).listTeams({ limit: 1 });

    expect(page.items).toEqual([
      {
        id: teamOne.id,
        name: 'Alpha',
        avatars: [
          { avatarId: 'test-bbbbbbbbbbbbbbbbbbbb', availability: 'withdrawn' },
          { avatarId: 'test-aaaaaaaaaaaaaaaaaaaa', availability: 'active' },
        ],
        createdAt: teamOne.created_at,
        updatedAt: teamOne.updated_at,
      },
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(gateway.listTeams).toHaveBeenCalledWith({ after: null, limit: 2 });
  });

  it('validates and normalizes creates while preserving the caller intent ID', async () => {
    const gateway = createGateway({
      createTeam: vi.fn().mockReturnValue(result(teamOne)),
    });
    const client = createTeamClient(gateway);

    await expect(
      client.createTeam({ id: teamOne.id, name: '  Alpha  ' }),
    ).resolves.toMatchObject({
      id: teamOne.id,
      name: 'Alpha',
      avatars: [],
    });
    expect(gateway.createTeam).toHaveBeenCalledWith({
      id: teamOne.id,
      name: 'Alpha',
    });
  });

  it('renames and idempotently deletes through the narrow RPC surface', async () => {
    const renamed = { ...teamOne, name: 'Renamed' };
    const gateway = createGateway({
      renameTeam: vi.fn().mockReturnValue(result(renamed)),
    });
    const client = createTeamClient(gateway);

    await expect(
      client.renameTeam({ teamId: teamOne.id, name: '  Renamed  ' }),
    ).resolves.toMatchObject({ id: teamOne.id, name: 'Renamed' });
    expect(gateway.renameTeam).toHaveBeenCalledWith({
      teamId: teamOne.id,
      name: 'Renamed',
    });
    await expect(client.deleteTeam(teamOne.id)).resolves.toBeUndefined();
    expect(gateway.deleteTeam).toHaveBeenCalledWith(teamOne.id);
  });

  it('replaces membership atomically and returns authoritative order', async () => {
    const gateway = createGateway({
      setMembers: vi.fn().mockReturnValue(
        result([
          { avatar_id: 'test-bbbbbbbbbbbbbbbbbbbb', position: 0 },
          { avatar_id: 'test-aaaaaaaaaaaaaaaaaaaa', position: 1 },
        ]),
      ),
      getTeam: vi.fn().mockReturnValue(result(teamOne)),
      listMembers: vi.fn().mockReturnValue(
        result([
          {
            team_id: teamOne.id,
            avatar_id: 'test-bbbbbbbbbbbbbbbbbbbb',
            position: 0,
            avatars: { publication_status: 'active' },
          },
          {
            team_id: teamOne.id,
            avatar_id: 'test-aaaaaaaaaaaaaaaaaaaa',
            position: 1,
            avatars: { publication_status: 'active' },
          },
        ]),
      ),
    });

    const updated = await createTeamClient(gateway).setMembers({
      teamId: teamOne.id,
      avatarIds: ['test-bbbbbbbbbbbbbbbbbbbb', 'test-aaaaaaaaaaaaaaaaaaaa'],
    });

    expect(updated.avatars.map(({ avatarId }) => avatarId)).toEqual([
      'test-bbbbbbbbbbbbbbbbbbbb',
      'test-aaaaaaaaaaaaaaaaaaaa',
    ]);
  });

  it('rejects duplicate members before calling the provider', async () => {
    const gateway = createGateway();
    const client = createTeamClient(gateway);

    await expect(
      client.setMembers({
        teamId: teamOne.id,
        avatarIds: ['test-aaaaaaaaaaaaaaaaaaaa', 'test-aaaaaaaaaaaaaaaaaaaa'],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(gateway.setMembers).not.toHaveBeenCalled();
  });
});

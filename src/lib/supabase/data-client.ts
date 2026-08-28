import { z } from 'zod';

import type {
  AgentTeam,
  FavoriteClient,
  Page,
  SavedAvatarRef,
  TeamClient,
} from '../contracts/identity';
import { mapProviderError, unexpectedResponse } from './errors';
import {
  decodeTeamCursor,
  encodeTeamCursor,
  parseAvatarId,
  parseMemberIds,
  parsePageLimit,
  parseTeamName,
  parseUuid,
  type TeamCursor,
} from './validation';

interface GatewayResult {
  data: unknown;
  error: unknown;
}

export interface IdentityDataGateway {
  listFavorites(): Promise<GatewayResult>;
  setFavorite(input: {
    avatarId: string;
    isFavorite: boolean;
  }): Promise<GatewayResult>;
  listTeams(input: {
    after: TeamCursor | null;
    limit: number;
  }): Promise<GatewayResult>;
  listMembers(teamIds: readonly string[]): Promise<GatewayResult>;
  createTeam(input: { id: string; name: string }): Promise<GatewayResult>;
  renameTeam(input: { teamId: string; name: string }): Promise<GatewayResult>;
  deleteTeam(teamId: string): Promise<GatewayResult>;
  setMembers(input: {
    teamId: string;
    avatarIds: readonly string[];
  }): Promise<GatewayResult>;
  getTeam(teamId: string): Promise<GatewayResult>;
}

const availabilitySchema = z.enum(['active', 'withdrawn']);
const favoriteRowsSchema = z.array(
  z.object({
    avatar_id: z.string(),
    avatars: z.object({ publication_status: availabilitySchema }),
  }),
);
const teamRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
const teamRowsSchema = z.array(teamRowSchema);
const memberRowsSchema = z.array(
  z.object({
    team_id: z.uuid(),
    avatar_id: z.string(),
    position: z.number().int().min(0).max(99),
    avatars: z.object({ publication_status: availabilitySchema }),
  }),
);
const storedMembersSchema = z.array(
  z.object({
    avatar_id: z.string(),
    position: z.number().int().min(0).max(99),
  }),
);
const POSTGREST_MEMBER_ROW_CAP = 1_000;
const TEAM_MEMBER_LIMIT = 100;
const MEMBER_TEAM_CHUNK_SIZE = Math.floor(
  POSTGREST_MEMBER_ROW_CAP / TEAM_MEMBER_LIMIT,
);

export function createFavoriteClient(
  gateway: IdentityDataGateway,
): FavoriteClient {
  return {
    async listFavorites() {
      const rows = parseProviderData(
        favoriteRowsSchema,
        await gateway.listFavorites(),
      );
      return rows.map((row) => ({
        avatarId: parseAvatarId(row.avatar_id),
        availability: row.avatars.publication_status,
      }));
    },

    async setFavorite(avatarId, isFavorite) {
      const parsedId = parseAvatarId(avatarId);
      const data = providerData(
        await gateway.setFavorite({ avatarId: parsedId, isFavorite }),
      );
      const result = z.boolean().safeParse(data);
      if (!result.success) throw unexpectedResponse(result.error);
      return result.data;
    },
  };
}

export function createTeamClient(gateway: IdentityDataGateway): TeamClient {
  return {
    async listTeams(input = {}): Promise<Page<AgentTeam>> {
      const limit = parsePageLimit(input.limit);
      const after =
        input.cursor === undefined ? null : decodeTeamCursor(input.cursor);
      const rows = parseProviderData(
        teamRowsSchema,
        await gateway.listTeams({ after, limit: limit + 1 }),
      );
      const hasNextPage = rows.length > limit;
      const pageRows = rows.slice(0, limit);
      const members = await loadMembers(
        gateway,
        pageRows.map(({ id }) => id),
      );
      const items = pageRows.map((row) =>
        toAgentTeam(row, members.get(row.id) ?? []),
      );
      const last = pageRows.at(-1);
      return {
        items,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeTeamCursor({ updatedAt: last.updated_at, id: last.id })
            : null,
      };
    },

    async createTeam(input) {
      const id = parseUuid(input.id);
      const name = parseTeamName(input.name);
      const row = parseProviderData(
        teamRowSchema,
        await gateway.createTeam({ id, name }),
      );
      return toAgentTeam(row, []);
    },

    async renameTeam(input) {
      const teamId = parseUuid(input.teamId);
      const name = parseTeamName(input.name);
      const row = parseProviderData(
        teamRowSchema,
        await gateway.renameTeam({ teamId, name }),
      );
      const members = await loadMembers(gateway, [teamId]);
      return toAgentTeam(row, members.get(teamId) ?? []);
    },

    async deleteTeam(teamId) {
      const data = providerData(await gateway.deleteTeam(parseUuid(teamId)));
      const result = z.boolean().safeParse(data);
      if (!result.success) throw unexpectedResponse(result.error);
    },

    async setMembers(input) {
      const teamId = parseUuid(input.teamId);
      const avatarIds = parseMemberIds(input.avatarIds);
      parseProviderData(
        storedMembersSchema,
        await gateway.setMembers({ teamId, avatarIds }),
      );
      const row = parseProviderData(
        teamRowSchema,
        await gateway.getTeam(teamId),
      );
      const members = await loadMembers(gateway, [teamId]);
      return toAgentTeam(row, members.get(teamId) ?? []);
    },
  };
}

async function loadMembers(
  gateway: IdentityDataGateway,
  teamIds: readonly string[],
): Promise<Map<string, SavedAvatarRef[]>> {
  if (teamIds.length === 0) return new Map();
  const uniqueTeamIds = [...new Set(teamIds)];
  const chunks = Array.from(
    { length: Math.ceil(uniqueTeamIds.length / MEMBER_TEAM_CHUNK_SIZE) },
    (_, index) =>
      uniqueTeamIds.slice(
        index * MEMBER_TEAM_CHUNK_SIZE,
        (index + 1) * MEMBER_TEAM_CHUNK_SIZE,
      ),
  );
  const chunkRows = await Promise.all(
    chunks.map(async (chunk) =>
      parseProviderData(memberRowsSchema, await gateway.listMembers(chunk)),
    ),
  );
  const uniqueRows = new Map<
    string,
    z.infer<typeof memberRowsSchema>[number]
  >();
  for (const [index, rows] of chunkRows.entries()) {
    const teamScope = new Set(chunks[index]);
    for (const row of rows) {
      if (!teamScope.has(row.team_id)) throw unexpectedResponse();
      const key = `${row.team_id}\u0000${row.avatar_id}`;
      const existing = uniqueRows.get(key);
      if (
        existing !== undefined &&
        (existing.position !== row.position ||
          existing.avatars.publication_status !==
            row.avatars.publication_status)
      ) {
        throw unexpectedResponse();
      }
      uniqueRows.set(key, row);
    }
  }
  const rows = [...uniqueRows.values()].sort((left, right) => {
    if (left.team_id !== right.team_id)
      return left.team_id < right.team_id ? -1 : 1;
    if (left.position !== right.position) return left.position - right.position;
    if (left.avatar_id === right.avatar_id) return 0;
    return left.avatar_id < right.avatar_id ? -1 : 1;
  });
  const members = new Map<string, SavedAvatarRef[]>();
  for (const row of rows) {
    const teamMembers = members.get(row.team_id) ?? [];
    teamMembers.push({
      avatarId: parseAvatarId(row.avatar_id),
      availability: row.avatars.publication_status,
    });
    members.set(row.team_id, teamMembers);
  }
  return members;
}

function toAgentTeam(
  row: z.infer<typeof teamRowSchema>,
  avatars: readonly SavedAvatarRef[],
): AgentTeam {
  return {
    id: row.id,
    name: row.name,
    avatars,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function providerData(result: GatewayResult): unknown {
  if (result.error !== null) throw mapProviderError(result.error);
  return result.data;
}

function parseProviderData<T>(schema: z.ZodType<T>, result: GatewayResult): T {
  const parsed = schema.safeParse(providerData(result));
  if (!parsed.success) throw unexpectedResponse(parsed.error);
  return parsed.data;
}

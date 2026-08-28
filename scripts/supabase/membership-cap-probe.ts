import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { createTeamClient } from '../../src/lib/supabase/data-client';
import type { Database } from '../../src/lib/supabase/database.types';
import { createSupabaseDataGateway } from '../../src/lib/supabase/supabase-gateway';

const TEAM_COUNT = 11;
const MEMBERS_PER_TEAM = 100;
const POSTGREST_ROW_CAP = 1_000;

function readLocalSupabaseEnvironment(): Record<string, string> {
  const output = execFileSync(
    'npx',
    ['supabase', 'status', '--output', 'env'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => {
        const value = match[2] ?? '';
        return [
          match[1] ?? '',
          value.startsWith('"') ? (JSON.parse(value) as string) : value,
        ];
      }),
  );
}

function requireEnvironmentValue(
  environment: Record<string, string>,
  names: readonly string[],
): string {
  for (const name of names) {
    const value = environment[name];
    if (value !== undefined && value !== '') return value;
  }
  throw new Error(`Missing local Supabase value: ${names.join(' or ')}`);
}

function assertNoProviderError(error: unknown, operation: string): void {
  if (error === null) return;
  throw new Error(`${operation} failed`, { cause: error });
}

const environment = readLocalSupabaseEnvironment();
const apiUrl = requireEnvironmentValue(environment, ['API_URL']);
const publishableKey = requireEnvironmentValue(environment, [
  'PUBLISHABLE_KEY',
  'ANON_KEY',
]);
const secretKey = requireEnvironmentValue(environment, [
  'SECRET_KEY',
  'SERVICE_ROLE_KEY',
]);
const admin = createClient<Database>(apiUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = `membership-cap-${randomUUID()}@example.com`;
const password = `Cap-${randomUUID()}-Aa1!`;
const avatarIds = Array.from(
  { length: MEMBERS_PER_TEAM },
  (_, index) => `probe-${index.toString(16).padStart(20, '0')}`,
);
let userId: string | undefined;

try {
  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  assertNoProviderError(createUserError, 'create probe user');
  assert(createdUser.user !== null, 'probe user was not returned');
  userId = createdUser.user.id;

  const { error: avatarError } = await admin.rpc('sync_avatar_catalog', {
    p_active: avatarIds.map((id, index) => ({
      id,
      generatorId: 'probe',
      preset: `Probe ${String(index)}`,
      assetPath: `/avatars/${id}.svg`,
      assetExtension: 'svg',
      mediaType: 'image/svg+xml',
      width: 64,
      height: 64,
      alt: `Probe avatar ${String(index)}`,
      tags: [],
      rightsId: 'probe-rights',
      provenanceId: 'probe-provenance',
      assetSha256: index.toString(16).padStart(64, '0'),
    })),
    p_withdrawals: [],
  });
  assertNoProviderError(avatarError, 'insert probe avatars');

  const authenticated = createClient<Database>(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await authenticated.auth.signInWithPassword({
    email,
    password,
  });
  assertNoProviderError(signInError, 'sign in probe user');

  const teamIds = Array.from({ length: TEAM_COUNT }, () => randomUUID());
  for (const [index, teamId] of teamIds.entries()) {
    const { error: teamError } = await authenticated.rpc('create_agent_team', {
      p_id: teamId,
      p_name: `Probe team ${String(index + 1).padStart(2, '0')}`,
    });
    assertNoProviderError(teamError, 'insert probe team');
    const { error: membershipError } = await authenticated.rpc(
      'set_agent_team_members',
      { p_team_id: teamId, p_avatar_ids: avatarIds },
    );
    assertNoProviderError(membershipError, 'insert probe memberships');
  }

  const { data: rawRows, error: rawReadError } = await authenticated
    .from('agent_team_avatars')
    .select('team_id')
    .in('team_id', teamIds)
    .order('team_id', { ascending: true })
    .order('position', { ascending: true });
  assertNoProviderError(rawReadError, 'read unchunked memberships');
  assert(rawRows !== null, 'unchunked membership rows were not returned');
  assert.equal(
    rawRows.length,
    POSTGREST_ROW_CAP,
    'local PostgREST did not enforce the configured 1,000-row cap',
  );

  const page = await createTeamClient(
    createSupabaseDataGateway(authenticated),
  ).listTeams({ limit: TEAM_COUNT });
  assert.equal(page.items.length, TEAM_COUNT);
  assert.equal(
    page.items.reduce((total, team) => total + team.avatars.length, 0),
    TEAM_COUNT * MEMBERS_PER_TEAM,
  );
  for (const team of page.items) {
    assert.deepEqual(
      team.avatars.map(({ avatarId }) => avatarId),
      avatarIds,
    );
  }

  console.log(
    `Verified ${String(TEAM_COUNT * MEMBERS_PER_TEAM)} memberships beyond the ${String(POSTGREST_ROW_CAP)}-row PostgREST cap.`,
  );
} finally {
  if (userId !== undefined) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    assertNoProviderError(error, 'delete probe user');
  }
}

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  anonymousToken,
  assertDenied,
  avatarIds,
  createTeam,
  createTestUser,
  deleteTestUser,
  rest,
  rpc,
  setMembers,
  syncTestAvatars,
} from './identity-test-helpers.mjs';

test('anonymous and two-user REST access matches the complete isolation matrix', async () => {
  const users = [];
  try {
    await syncTestAvatars();
    const userA = await createTestUser('rest-a');
    const userB = await createTestUser('rest-b');
    users.push(userA, userB);
    const teamA = '10000000-0000-4000-8000-00000000000a';
    const teamB = '10000000-0000-4000-8000-00000000000b';
    const missingUser = '00000000-0000-4000-8000-000000000099';
    const missingTeam = '10000000-0000-4000-8000-000000000099';

    assert.equal(
      (
        await rpc(userA.token, 'set_favorite', {
          p_avatar_id: avatarIds[0],
          p_is_favorite: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await createTeam(userA.token, teamA, 'Alpha private')).status,
      200,
    );
    assert.equal(
      (await setMembers(userA.token, teamA, [avatarIds[0], avatarIds[1]]))
        .status,
      200,
    );
    assert.equal(
      (
        await rpc(userB.token, 'set_favorite', {
          p_avatar_id: avatarIds[2],
          p_is_favorite: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await createTeam(userB.token, teamB, 'Beta private')).status,
      200,
    );
    assert.equal(
      (await setMembers(userB.token, teamB, [avatarIds[2]])).status,
      200,
    );

    const anonymousCatalog = await rest(
      anonymousToken,
      'avatars?select=id&order=id',
    );
    assert.equal(anonymousCatalog.status, 200, anonymousCatalog.text);
    assert.deepEqual(
      anonymousCatalog.body.map(({ id }) => id),
      avatarIds,
    );
    for (const table of [
      'profiles',
      'favorites',
      'agent_teams',
      'agent_team_avatars',
    ]) {
      assertDenied(
        await rest(anonymousToken, `${table}?select=*`),
        `anonymous SELECT ${table}`,
      );
    }

    for (const [label, actor, ownTeam, ownAvatar] of [
      ['user A', userA, teamA, avatarIds[0]],
      ['user B', userB, teamB, avatarIds[2]],
    ]) {
      const expectedReads = [
        ['profiles?select=user_id', [{ user_id: actor.id }]],
        [
          'favorites?select=user_id,avatar_id',
          [{ user_id: actor.id, avatar_id: ownAvatar }],
        ],
        ['agent_teams?select=id,user_id', [{ id: ownTeam, user_id: actor.id }]],
        [
          'agent_team_avatars?select=team_id,avatar_id,position&order=position',
          ownTeam === teamA
            ? [
                { team_id: teamA, avatar_id: avatarIds[0], position: 0 },
                { team_id: teamA, avatar_id: avatarIds[1], position: 1 },
              ]
            : [{ team_id: teamB, avatar_id: avatarIds[2], position: 0 }],
        ],
      ];
      for (const [path, expected] of expectedReads) {
        const response = await rest(actor.token, path);
        assert.equal(
          response.status,
          200,
          `${label} ${path}: ${response.text}`,
        );
        assert.deepEqual(response.body, expected, `${label} ${path}`);
      }
      assert.equal(
        (await rest(actor.token, 'avatars?select=id')).body.length,
        avatarIds.length,
      );
    }

    const hiddenRows = [
      ['profiles', 'user_id', userB.id, missingUser],
      ['favorites', 'user_id', userB.id, missingUser],
      ['agent_teams', 'id', teamB, missingTeam],
      ['agent_team_avatars', 'team_id', teamB, missingTeam],
    ];
    for (const [table, column, crossOwnerId, absentId] of hiddenRows) {
      const crossOwner = await rest(
        userA.token,
        `${table}?select=*&${column}=eq.${crossOwnerId}`,
      );
      const missing = await rest(
        userA.token,
        `${table}?select=*&${column}=eq.${absentId}`,
      );
      assert.equal(crossOwner.status, 200, crossOwner.text);
      assert.equal(missing.status, 200, missing.text);
      assert.deepEqual(crossOwner.body, []);
      assert.deepEqual(
        crossOwner.body,
        missing.body,
        `${table} cross-owner and missing differ`,
      );
    }

    const mutationCases = [
      {
        table: 'profiles',
        filter: `user_id=eq.${userA.id}`,
        insert: { user_id: userA.id },
        update: { updated_at: '2026-08-28T00:00:00Z' },
      },
      {
        table: 'avatars',
        filter: `id=eq.${avatarIds[0]}`,
        insert: {
          id: 'test-eeeeeeeeeeeeeeeeeeee',
          generator_id: 'test',
          preset: 'blocked',
          asset_path: '/avatars/test-eeeeeeeeeeeeeeeeeeee.svg',
          asset_extension: 'svg',
          media_type: 'image/svg+xml',
          width: 128,
          height: 128,
          alt: 'Blocked direct insert',
          tags: [],
          rights_id: 'cc0-test',
          provenance_id: 'blocked',
          asset_sha256: 'e'.repeat(64),
        },
        update: { alt: 'Blocked direct update' },
      },
      {
        table: 'favorites',
        filter: `user_id=eq.${userA.id}`,
        insert: { user_id: userA.id, avatar_id: avatarIds[1] },
        update: { avatar_id: avatarIds[1] },
      },
      {
        table: 'agent_teams',
        filter: `id=eq.${teamA}`,
        insert: { id: missingTeam, user_id: userA.id, name: 'Blocked' },
        update: { name: 'Blocked direct rename' },
      },
      {
        table: 'agent_team_avatars',
        filter: `team_id=eq.${teamA}`,
        insert: { team_id: teamA, avatar_id: avatarIds[3], position: 3 },
        update: { position: 3 },
      },
    ];
    for (const [label, token] of [
      ['anonymous', anonymousToken],
      ['user A', userA.token],
      ['user B', userB.token],
    ]) {
      for (const mutation of mutationCases) {
        for (const operation of [
          {
            name: 'INSERT',
            method: 'POST',
            path: mutation.table,
            body: mutation.insert,
          },
          {
            name: 'UPDATE',
            method: 'PATCH',
            path: `${mutation.table}?${mutation.filter}`,
            body: mutation.update,
          },
          {
            name: 'DELETE',
            method: 'DELETE',
            path: `${mutation.table}?${mutation.filter}`,
          },
        ]) {
          const response = await rest(token, operation.path, {
            method: operation.method,
            body: operation.body,
          });
          assertDenied(
            response,
            `${label} ${operation.name} ${mutation.table}`,
          );
          assert.doesNotMatch(
            response.text,
            /Alpha private|Beta private|@example\.test/,
          );
        }
      }
    }

    for (const [functionName, crossBody, missingBody] of [
      [
        'rename_agent_team',
        { p_team_id: teamB, p_name: 'Guessed' },
        { p_team_id: missingTeam, p_name: 'Guessed' },
      ],
      [
        'set_agent_team_members',
        { p_team_id: teamB, p_avatar_ids: [avatarIds[0]] },
        { p_team_id: missingTeam, p_avatar_ids: [avatarIds[0]] },
      ],
    ]) {
      const crossOwner = await rpc(userA.token, functionName, crossBody);
      const missing = await rpc(userA.token, functionName, missingBody);
      assert.equal(crossOwner.status, 400, crossOwner.text);
      assert.equal(missing.status, 400, missing.text);
      assert.deepEqual(crossOwner.body, missing.body);
      assert.equal(crossOwner.body.message, 'NOT_FOUND');
    }

    const crossDelete = await rpc(userA.token, 'delete_agent_team', {
      p_team_id: teamB,
    });
    const missingDelete = await rpc(userA.token, 'delete_agent_team', {
      p_team_id: missingTeam,
    });
    assert.equal(crossDelete.status, 200, crossDelete.text);
    assert.deepEqual(crossDelete.body, missingDelete.body);
    assert.equal(crossDelete.body, true);
    assert.deepEqual(
      (
        await rest(
          userB.token,
          `agent_teams?select=id,user_id,name&id=eq.${teamB}`,
        )
      ).body,
      [{ id: teamB, user_id: userB.id, name: 'Beta private' }],
    );

    const collision = await createTeam(userB.token, teamA, 'Collision probe');
    assert.equal(collision.status, 400, collision.text);
    assert.equal(collision.body.message, 'CONFLICT');
    assert.doesNotMatch(collision.text, /Alpha private|rest-a|@example\.test/);
  } finally {
    await Promise.allSettled(users.map(deleteTestUser));
  }
});

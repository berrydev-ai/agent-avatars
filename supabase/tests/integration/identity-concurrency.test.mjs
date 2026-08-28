import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avatarIds,
  createTeam,
  createTestUser,
  deleteTestUser,
  rest,
  setMembers,
  syncTestAvatars,
} from './identity-test-helpers.mjs';

test('concurrent creates enforce per-user limits and retry-safe intent IDs', async () => {
  const users = [];
  try {
    await syncTestAvatars();
    const userA = await createTestUser('concurrency-create-a');
    const userB = await createTestUser('concurrency-create-b');
    users.push(userA, userB);

    const teamIds = Array.from(
      { length: 51 },
      (_, index) =>
        `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    const initialCreates = await Promise.all(
      teamIds
        .slice(0, 49)
        .map((id, index) => createTeam(userA.token, id, `Team ${index + 1}`)),
    );
    assert.ok(initialCreates.every(({ status }) => status === 200));

    const limitRace = await Promise.all([
      createTeam(userA.token, teamIds[49], 'Team 50 A'),
      createTeam(userA.token, teamIds[50], 'Team 50 B'),
    ]);
    assert.deepEqual(limitRace.map(({ status }) => status).sort(), [200, 400]);
    assert.equal(
      limitRace.find(({ status }) => status === 400).body.message,
      'VALIDATION_ERROR',
    );
    const storedTeams = await rest(userA.token, 'agent_teams?select=id');
    assert.equal(storedTeams.status, 200, storedTeams.text);
    assert.equal(storedTeams.body.length, 50);

    const retryId = '30000000-0000-4000-8000-000000000001';
    const retries = await Promise.all([
      createTeam(userB.token, retryId, 'Retry safe'),
      createTeam(userB.token, retryId, 'Retry safe'),
    ]);
    assert.ok(retries.every(({ status }) => status === 200));
    assert.deepEqual(retries[0].body, retries[1].body);
    assert.equal(
      (await rest(userB.token, 'agent_teams?select=id')).body.length,
      1,
    );
  } finally {
    await Promise.allSettled(users.map(deleteTestUser));
  }
});

test('concurrent reorders stay atomic and isolated across owners', async () => {
  const users = [];
  try {
    await syncTestAvatars();
    const userA = await createTestUser('concurrency-order-a');
    const userB = await createTestUser('concurrency-order-b');
    users.push(userA, userB);
    const teamA = '40000000-0000-4000-8000-00000000000a';
    const teamB = '40000000-0000-4000-8000-00000000000b';
    assert.equal((await createTeam(userA.token, teamA, 'Order A')).status, 200);
    assert.equal((await createTeam(userB.token, teamB, 'Order B')).status, 200);
    assert.equal((await setMembers(userA.token, teamA, avatarIds)).status, 200);
    assert.equal(
      (await setMembers(userB.token, teamB, [...avatarIds].reverse())).status,
      200,
    );

    const orderOne = [avatarIds[1], avatarIds[2], avatarIds[3], avatarIds[0]];
    const orderTwo = [avatarIds[3], avatarIds[0], avatarIds[1], avatarIds[2]];
    const sameOwnerRace = await Promise.all([
      setMembers(userA.token, teamA, orderOne),
      setMembers(userA.token, teamA, orderTwo),
    ]);
    assert.ok(sameOwnerRace.every(({ status }) => status === 200));
    const afterSameOwnerRace = await readOrder(userA.token, teamA);
    assert.ok(
      sameOrder(afterSameOwnerRace, orderOne) ||
        sameOrder(afterSameOwnerRace, orderTwo),
      `stored partial order: ${JSON.stringify(afterSameOwnerRace)}`,
    );
    assertContiguous(afterSameOwnerRace);

    const ownerOrder = [avatarIds[2], avatarIds[1], avatarIds[0], avatarIds[3]];
    const [ownerResult, attackerResult] = await Promise.all([
      setMembers(userA.token, teamA, ownerOrder),
      setMembers(userB.token, teamA, [avatarIds[0]]),
    ]);
    assert.equal(ownerResult.status, 200, ownerResult.text);
    assert.equal(attackerResult.status, 400, attackerResult.text);
    assert.equal(attackerResult.body.message, 'NOT_FOUND');
    assert.deepEqual(await readOrder(userA.token, teamA), ownerOrder);
    assert.deepEqual(await readOrder(userB.token, teamA), []);

    const independentA = [avatarIds[0], avatarIds[3]];
    const independentB = [avatarIds[1], avatarIds[2], avatarIds[0]];
    const independentRace = await Promise.all([
      setMembers(userA.token, teamA, independentA),
      setMembers(userB.token, teamB, independentB),
    ]);
    assert.ok(independentRace.every(({ status }) => status === 200));
    assert.deepEqual(await readOrder(userA.token, teamA), independentA);
    assert.deepEqual(await readOrder(userB.token, teamB), independentB);
    assert.deepEqual(await readOrder(userA.token, teamB), []);
    assert.deepEqual(await readOrder(userB.token, teamA), []);
  } finally {
    await Promise.allSettled(users.map(deleteTestUser));
  }
});

async function readOrder(token, teamId) {
  const response = await rest(
    token,
    `agent_team_avatars?select=avatar_id,position&team_id=eq.${teamId}&order=position`,
  );
  assert.equal(response.status, 200, response.text);
  assertContiguous(response.body);
  return response.body.map(({ avatar_id: avatarId }) => avatarId);
}

function assertContiguous(rows) {
  if (rows.length === 0 || typeof rows[0] === 'string') return;
  assert.deepEqual(
    rows.map(({ position }) => position),
    Array.from({ length: rows.length }, (_, index) => index),
  );
  assert.equal(
    new Set(rows.map(({ avatar_id: avatarId }) => avatarId)).size,
    rows.length,
  );
}

function sameOrder(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

const apiUrl = requiredEnvironment('API_URL');
const anonKey = requiredEnvironment('ANON_KEY');
const serviceRoleKey = requiredEnvironment('SERVICE_ROLE_KEY');
const password = 'Local-only-test-passphrase-42';

export const avatarIds = [
  'test-aaaaaaaaaaaaaaaaaaaa',
  'test-bbbbbbbbbbbbbbbbbbbb',
  'test-cccccccccccccccccccc',
  'test-dddddddddddddddddddd',
];
export const anonymousToken = anonKey;

export async function createTestUser(label) {
  const nonce = randomUUID();
  const email = `${label}-${nonce}@example.test`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    apiKey: serviceRoleKey,
    token: serviceRoleKey,
    body: { email, password, email_confirm: true },
  });
  assert.equal(created.status, 200, created.text);
  assert.match(created.body.id, /^[0-9a-f-]{36}$/);

  const signedIn = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(signedIn.status, 200, signedIn.text);
  assert.equal(signedIn.body.user.id, created.body.id);
  assert.ok(signedIn.body.access_token);

  return { id: created.body.id, token: signedIn.body.access_token };
}

export async function deleteTestUser(user) {
  const response = await request(`/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    apiKey: serviceRoleKey,
    token: serviceRoleKey,
  });
  assert.ok([200, 204, 404].includes(response.status), response.text);
}

export async function syncTestAvatars() {
  const active = avatarIds.map((id, index) => {
    const extension = index % 2 === 0 ? 'svg' : 'png';
    return {
      id,
      generatorId: 'test',
      preset: `synthetic-${index}`,
      assetPath: `/avatars/${id}.${extension}`,
      assetExtension: extension,
      mediaType: extension === 'svg' ? 'image/svg+xml' : 'image/png',
      width: 128,
      height: 128,
      alt: `Synthetic avatar ${index}`,
      tags: [`theme:test-${index}`],
      rightsId: 'cc0-test',
      provenanceId: `test-${index}`,
      assetSha256: String(index + 1).repeat(64),
    };
  });
  const response = await request('/rest/v1/rpc/sync_avatar_catalog', {
    method: 'POST',
    apiKey: serviceRoleKey,
    token: serviceRoleKey,
    body: { p_active: active, p_withdrawals: [] },
  });
  assert.equal(response.status, 204, response.text);
}

export function rest(token, path, options = {}) {
  return request(`/rest/v1/${path}`, { ...options, token });
}

export function rpc(token, functionName, body) {
  return rest(token, `rpc/${functionName}`, { method: 'POST', body });
}

export async function createTeam(token, id, name) {
  return rpc(token, 'create_agent_team', { p_id: id, p_name: name });
}

export async function setMembers(token, teamId, requestedAvatarIds) {
  return rpc(token, 'set_agent_team_members', {
    p_team_id: teamId,
    p_avatar_ids: requestedAvatarIds,
  });
}

export function assertDenied(response, context) {
  assert.ok(
    response.status === 401 || response.status === 403,
    `${context}: expected 401/403, received ${response.status}: ${response.text}`,
  );
}

async function request(
  path,
  {
    method = 'GET',
    apiKey = anonKey,
    token = anonKey,
    body,
    headers = {},
  } = {},
) {
  const response = await globalThis.fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text !== '') {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed, text };
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required local test environment: ${name}`);
  return value;
}

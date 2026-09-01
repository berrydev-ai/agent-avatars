import { randomUUID } from 'node:crypto';

import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
} from '@playwright/test';
import avatarManifest from '../../public/avatars/manifest.json' with { type: 'json' };

const mailpitUrl =
  process.env.PLAYWRIGHT_MAILPIT_URL ?? 'http://127.0.0.1:54324';
const appUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const supabaseUrl =
  process.env.PLAYWRIGHT_SUPABASE_URL ?? 'http://127.0.0.1:54321';

test('persists favorites and a fully edited Agent Team', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) =>
    browserErrors.push(`pageerror: ${error.message}`),
  );

  const nonce = randomUUID();
  const email = `avatar-e2e-${nonce}@example.test`;
  const password = `verified-${nonce}-password`;
  const teamName = `Browser Team ${nonce}`;

  await syncCatalog(request);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /give every agent a memorable face/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page
    .getByRole('dialog')
    .locator('form')
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(`Check ${email}`);

  const confirmationUrl = await findConfirmationUrl(request, email);
  await page.goto(confirmationUrl);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/confirm$/);

  const catalog = page.getByRole('list', { name: 'Avatar catalog' });
  const firstCard = catalog.locator(':scope > li').first();
  await firstCard
    .getByRole('button', { name: /^Save .* to favorites$/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Saved avatars (1)' }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('button', { name: 'Saved avatars (1)' }).click();
  await expect(catalog.locator(':scope > li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Saved avatars (1)' }).click();

  await page.getByRole('button', { name: 'Agent Teams (0)' }).click();
  await expect(page.getByText('No Agent Teams yet.')).toBeVisible();
  await page.getByLabel('New team name').fill(teamName);
  await page.getByRole('button', { name: 'Create team' }).click();
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();

  const addButtons = page.getByRole('button', {
    name: new RegExp(`^Add .+ to ${escapeRegex(teamName)}$`),
  });
  await addButtons.first().click();
  await addButtons.first().click();

  const members = page.getByRole('list', { name: `Members of ${teamName}` });
  await expect(members.locator(':scope > li')).toHaveCount(2);
  const originalOrder = await memberNames(members);
  await members
    .getByRole('button', {
      name: new RegExp(`^Move ${escapeRegex(originalOrder[0] ?? '')} down$`),
    })
    .click();
  const reordered = [originalOrder[1], originalOrder[0]];
  await expect(members.locator(':scope > li').first()).toContainText(
    reordered[0] ?? '',
  );

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('button', { name: 'Agent Teams (1)' }).click();
  const restoredMembers = page.getByRole('list', {
    name: `Members of ${teamName}`,
  });
  await expect(restoredMembers.locator(':scope > li')).toHaveCount(2);
  expect(await memberNames(restoredMembers)).toEqual(reordered);

  const renamedTeam = `${teamName} Renamed`;
  await page.getByLabel(`Rename ${teamName}`).fill(renamedTeam);
  await page.getByRole('button', { name: 'Save team name' }).click();
  await expect(page.getByRole('heading', { name: renamedTeam })).toBeVisible();

  await restoredMembers
    .getByRole('button', { name: /^Remove .+ from / })
    .first()
    .click();
  await expect(restoredMembers.locator(':scope > li')).toHaveCount(1);

  await page.getByRole('button', { name: `Delete ${renamedTeam}` }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: renamedTeam })).toBeVisible();
  await page.getByRole('button', { name: `Delete ${renamedTeam}` }).click();
  await page
    .getByRole('button', { name: `Confirm delete ${renamedTeam}` })
    .click();
  await expect(page.getByText('No Agent Teams yet.')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(catalog.locator(':scope > li')).toHaveCount(
    avatarManifest.avatars.length,
  );
  expect(browserErrors).toEqual([]);
});

async function findConfirmationUrl(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  let messageId = '';
  await expect
    .poll(async () => {
      const response = await request.get(`${mailpitUrl}/api/v1/messages`);
      expect(response.ok()).toBe(true);
      const body: unknown = await response.json();
      messageId = findMessageId(body, email);
      return messageId;
    })
    .not.toBe('');

  const response = await request.get(
    `${mailpitUrl}/api/v1/message/${messageId}`,
  );
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  const source = textField(body, 'HTML') || textField(body, 'Text');
  const match = source.match(/https?:\/\/[^"'\s<>]+\/auth\/confirm#[^"'\s<>]+/);
  expect(match, 'confirmation email contains a callback URL').not.toBeNull();
  const url = new URL((match?.[0] ?? '').replaceAll('&amp;', '&'));
  expect(url.origin).toBe(appUrl);
  expect(url.pathname).toBe('/auth/confirm');
  expect(url.hash).toMatch(/^#token_hash=[^&]+&type=email$/);
  return url.href;
}

async function syncCatalog(request: APIRequestContext): Promise<void> {
  const secretKey = process.env.PLAYWRIGHT_SUPABASE_SECRET_KEY;
  expect(secretKey, 'local Supabase secret key is configured').toBeTruthy();
  const manifestResponse = await request.get(`${appUrl}/avatars/manifest.json`);
  expect(manifestResponse.ok()).toBe(true);
  const manifest: unknown = await manifestResponse.json();
  expect(isRecord(manifest) && Array.isArray(manifest.avatars)).toBe(true);
  const avatars =
    isRecord(manifest) && Array.isArray(manifest.avatars)
      ? manifest.avatars
      : [];
  const response = await request.post(
    `${supabaseUrl}/rest/v1/rpc/sync_avatar_catalog`,
    {
      headers: {
        apikey: secretKey ?? '',
        Authorization: `Bearer ${secretKey ?? ''}`,
      },
      data: { p_active: avatars, p_withdrawals: [] },
    },
  );
  expect(response.ok(), await response.text()).toBe(true);
}

function findMessageId(body: unknown, email: string): string {
  if (!isRecord(body) || !Array.isArray(body.messages)) return '';
  for (const message of body.messages) {
    if (!isRecord(message) || typeof message.ID !== 'string') continue;
    if (
      Array.isArray(message.To) &&
      message.To.some(
        (recipient) => isRecord(recipient) && recipient.Address === email,
      )
    ) {
      return message.ID;
    }
  }
  return '';
}

function textField(body: unknown, key: string): string {
  return isRecord(body) && typeof body[key] === 'string' ? body[key] : '';
}

async function memberNames(members: Locator): Promise<string[]> {
  return members.locator(':scope > li > span').allTextContents();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

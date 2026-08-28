import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const avatarId = 'dicebear-00671c8c38d35c00ba6d';
const avatarFilename = `${avatarId}.svg`;
const avatarPath = `/avatars/${avatarFilename}`;
const avatarSha256 =
  '00671c8c38d35c00ba6d28ed6fe4b9fe791a8c8d7e92d10a837e08e3c9961e2f';

test('search and tag state survives reload with keyboard-visible results', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('504 avatars')).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Search avatars' });
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('Tab');
    if (await search.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(search).toBeFocused();
  await search.fill(avatarId);
  await search.press('Enter');
  await page.getByRole('button', { name: 'Bald' }).click();

  await expect(page.getByText('1 avatar')).toHaveAttribute(
    'aria-live',
    'polite',
  );
  await expect(
    page.getByRole('list', { name: 'Avatar catalog' }),
  ).toContainText('Pixel Art Neutral');
  await expect(page).toHaveURL(`/?q=${avatarId}&tags=hair%3Abald`);

  await page.reload();
  await expect(search).toHaveValue(avatarId);
  await expect(page.getByRole('button', { name: 'Bald' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('1 avatar')).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('download, open, and copy actions use the canonical verified asset', async ({
  page,
}) => {
  await mockClipboard(page, false);
  await openSingleAvatar(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(avatarFilename);
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  if (!downloadedPath)
    throw new Error('Playwright did not retain the download.');
  const downloadedBytes = await readFile(downloadedPath);
  expect(createHash('sha256').update(downloadedBytes).digest('hex')).toBe(
    avatarSha256,
  );
  await expect(page.getByRole('status')).toContainText('Downloaded');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open' }).click();
  const popup = await popupPromise;
  await expect.poll(() => new URL(popup.url()).pathname).toBe(avatarPath);
  await expect
    .poll(() => popup.evaluate((): boolean => window.opener === null))
    .toBe(true);
  await popup.close();

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Copied the link for Pixel Art Neutral agent avatar',
  );
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('e2e-clipboard')))
    .toBe(`http://127.0.0.1:4173${avatarPath}`);
});

async function openSingleAvatar(page: Page): Promise<void> {
  await page.goto(`/?q=${avatarId}`);
  await expect(page.getByText('1 avatar')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Avatar catalog' }),
  ).toBeVisible();
}

async function mockClipboard(page: Page, rejectWrite: boolean): Promise<void> {
  await page.addInitScript((shouldReject) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(value: string): Promise<void> {
          if (shouldReject)
            return Promise.reject(new Error('Denied by browser.'));
          sessionStorage.setItem('e2e-clipboard', value);
          return Promise.resolve();
        },
      },
    });
  }, rejectWrite);
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const releaseBlockingViolations = results.violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(releaseBlockingViolations).toEqual([]);
}

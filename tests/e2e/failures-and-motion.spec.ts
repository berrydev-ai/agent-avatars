import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import avatarManifest from '../../public/avatars/manifest.json';

const avatarId = 'dicebear-00671c8c38d35c00ba6d';
const avatarPath = `/avatars/${avatarId}.svg`;

test('a manifest outage is contained and retry restores the catalog', async ({
  page,
}) => {
  let manifestRequests = 0;
  await page.route('**/avatars/manifest.json', async (route) => {
    manifestRequests += 1;
    if (manifestRequests === 1) {
      await route.fulfill({ status: 503, body: 'temporarily unavailable' });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('We couldn’t open the avatar library.');
  await expectNoSeriousAxeViolations(page);

  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(
    page.getByText(`${avatarManifest.avatars.length} avatars`),
  ).toBeVisible();
  expect(manifestRequests).toBe(2);
});

test('network and clipboard failures produce useful announced fallbacks', async ({
  page,
}) => {
  await mockRejectedClipboard(page);
  await page.route(`**${avatarPath}`, async (route) => route.abort('failed'));
  await page.goto(`/?q=${avatarId}`);
  await expect(page.getByText('1 avatar')).toBeVisible();

  await page.getByRole('button', { name: 'Download' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Download failed for Pixel Art Neutral agent avatar',
  );

  await page.getByRole('button', { name: 'Copy link' }).click();
  const fallback = page.getByRole('textbox', { name: 'Canonical avatar link' });
  await expect(page.getByRole('status')).toContainText(
    'Clipboard access is unavailable.',
  );
  await expect(fallback).toHaveValue(`http://127.0.0.1:4173${avatarPath}`);
  await fallback.focus();
  await expect(fallback).toBeFocused();
  await expectNoSeriousAxeViolations(page);
});

test('reduced motion collapses the loading animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/avatars/manifest.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loadingTile = page.locator('.loading-grid span').first();
  await expect(loadingTile).toBeVisible();
  const animationDurationInSeconds = await loadingTile.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).animationDuration),
  );
  expect(animationDurationInSeconds).toBeLessThanOrEqual(0.000_01);
  await expect(
    page.getByText(`${avatarManifest.avatars.length} avatars`),
  ).toBeVisible();
});

async function mockRejectedClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(): Promise<void> {
          return Promise.reject(new Error('Denied by browser.'));
        },
      },
    });
  });
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

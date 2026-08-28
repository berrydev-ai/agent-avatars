import { expect, test } from '@playwright/test';

test('release gate sentinel', () => {
  expect('E2E must block verification').toBe('blocked by sentinel');
});

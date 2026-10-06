import { test as base, expect } from '@playwright/test';

export const test = base.extend<{
  authenticatedPage: any;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Login before each test
    await page.goto('http://localhost:3000');
    await page.fill('input[type="email"]', 'demo@genx.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await use(page);
  },
});

export { expect };

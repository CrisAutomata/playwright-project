import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    await use(page);
  },
});
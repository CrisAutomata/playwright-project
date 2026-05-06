import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    //use networkidle to ensure page is fully loaded before performing any actions
    // because the networkidle event is triggered when there are no more than 0 network connections for at least 500 ms, it ensures that all resources (like images, scripts, etc.) are fully loaded before the test continues. This can help prevent flaky tests that might occur if the test tries to interact with elements that haven't fully loaded yet.
    await this.page.goto('/', { waitUntil: 'networkidle' });
  }
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    await use(page);
  },
});
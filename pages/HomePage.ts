import { Locator, expect } from '@playwright/test';
import { HOME_PAGE_TITLE, CHECKOUT_TITLE, PRODUCT_PAGE_TITLE, CART_PAGE_TITLE } from '../data/constants';
import { BasePage } from './BasePage';
import { Page } from '@playwright/test';

export class HomePage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  async selectCategory(category: string) {
    await this.page.locator(`//a[text()='${category}']`).click();
  }

  async typeSearch(query: string) {
    await this.page.locator('//input[@name="search"]').fill(query);
  }

  async selectType(type: string) {
    // open type dropdown
    const typeDropdown: Locator = this.page.locator(`//p[text()='Type']/following-sibling::div[1]`);
    await typeDropdown.click();

    // select type from dropdown
    const typeOption: Locator = this.page.locator(`//div[contains(@class,'menu')]//div[text()='${type}']`);
    await typeOption.click();
  }

  async selectGenre(genre: string) {
    const genres = genre.split(',').map(g => g.trim());
    // select multiple genres if provided
    for (const genre of genres) {
      // open genre dropdown
      const genreDropdown: Locator = this.page.locator(`//p[text()='Genre']/following-sibling::div[1]`);
      await genreDropdown.click();
      // select genre from dropdown
      const genreOption: Locator = this.page.locator(`//div[contains(@class,'menu')]//div[text()='${genre}']`);
      await genreOption.click();
    }

  }

  async selectYearRange(fromYear: number, toYear: number) {
    const fromYearDropdown: Locator = this.page.locator(`//p[text()='Year']/following-sibling::div[1]/div[1]`);
    const toYearDropdown: Locator = this.page.locator(`//p[text()='Year']/following-sibling::div[1]/div[2]`);
    // select from year
    await fromYearDropdown.click();
    await fromYearDropdown.locator(`//div[contains(@class,'menu')]//div[text()='${fromYear}']`).click();
    // select to year
    await toYearDropdown.click();
    await toYearDropdown.locator(`//div[contains(@class,'menu')]//div[text()='${toYear}']`).click();

  }

  async selectRating(rating: number) {
    const ratingStars: Locator = this.page.locator(`//ul[@class="rc-rate"]//li[${rating}]`);
    await ratingStars.click();
  }



  async selectPage(page: string) {
    const pagination: Locator = this.page.locator('//div[@id="react-paginate"]');
    switch (page) {
      case 'first':
        await pagination.locator('li').first().click();
        break;
      case 'next':
        await pagination.locator("//li[@class='Next']").click();
        break;
      case 'last':
        await pagination.locator('li').last().click();
        break;
      default:
        throw new Error(`Page ${page} is not supported`);
    }
  }

  async verifyResults(cat: string, title: string, type: string, fromYear: number, toYear: number, rating: number, genre: string) {
    //get all result items
    const resultTags: Locator = this.page.locator('//div[./img][not(./input)]');
    for (let i = 0; i < await resultTags.count(); i++) {
      // for each result, verify it matches the filters
      // extract name, genre, year from result
      const result = resultTags.nth(i);
      const actualName = (await result.locator('xpath=./p[1]').innerText());
      const actualGenre = (await result.locator('xpath=./p[2]').innerText()).split(',')[0].trim();
      const actualYear = (await result.locator('xpath=./p[2]').innerText()).split(',')[1].trim();
      // verify name contains search query, genre matches selected genre, year is within selected range
      expect(actualName).toContain(title);
      expect(genre.toString()).toContain(actualGenre);
      expect(parseInt(actualYear)).toBeGreaterThanOrEqual(fromYear);
      expect(parseInt(actualYear)).toBeLessThanOrEqual(toYear);
    }
  }
}
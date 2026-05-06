import { test } from '../pages/BasePage';
import { HomePage } from '../pages/HomePage';


[
  { cat: 'Popular', title: 'Doc', type: 'Movie', genres: 'Animation', fromYear: 2020, toYear: 2022, rating: 1, paging: 'first' },
  { cat: 'Trend', title: 'Doc', type: 'TV Shows', genres: 'Comedy', fromYear: 2020, toYear: 2022, rating: 5, paging: 'next' },
  { cat: 'Newest', title: 'Doc', type: 'Movie', genres: 'Animation, Comedy', fromYear: 2020, toYear: 2022, rating: 4, paging: 'last' }
].forEach(({ cat, title, type, fromYear, toYear, rating, genres, paging }) => {
  test(`Filter by ${cat}, ${title}, ${type}, ${fromYear}-${toYear}, ${rating}, ${genres}, ${paging}`, async ({ page }) => {
    const home = new HomePage(page);
    // goto home page
    await test.step('Navigate to login page', async () => {
      await home.goto();
    });
    //apply filters and verify results
    await test.step('Select category', async () => {
      await home.selectCategory(cat);
    });
    await test.step('Type search query', async () => {
      // type search query
      await home.typeSearch(title);
    });
    await test.step('Select type', async () => {
      // select type
      await home.selectType(type);
    });
    await test.step('Select genre', async () => {
      // select genre
      await home.selectGenre(genres);
    });
    await test.step('Select year range', async () => {
      // select year range
      await home.selectYearRange(fromYear, toYear);
    });
    await test.step('Select rating', async () => {
      // select rating
      await home.selectRating(rating);
      await home.page.waitForTimeout(1000); // wait for results to load
    });
    await test.step('Select page and verify results', async () => {
      // select page
      await home.selectPage(paging);
    });
    await test.step('Verify results', async () => {
      // verify results match filters
      await home.verifyResults(cat, title, type, fromYear, toYear, rating, genres);
    });

  })
});

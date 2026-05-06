import { test } from '../pages/BasePage';
import { HomePage } from '../pages/HomePage';


// to test different filter combinations, we can use test.each to run the same test with different data sets
// this allows us to easily add more test cases by simply adding more objects to the array without having to duplicate the test code
// parameters include category, search query, type, genre, year range, rating, and pagination to cover various filter combinations and ensure the filtering functionality works correctly under different scenarios
// it's scalable and maintainable as we can easily add more test cases by adding more objects to the array without having to write new test code for each case
// Using soft assertions allows us to verify all results and report all failures at the end instead of stopping at the first failure, providing a more comprehensive view of any issues with the filtering functionality across all results.

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
      //wait for network to be idle after applying filters before verifying results to ensure all results are loaded
      await home.page.waitForLoadState('networkidle');
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

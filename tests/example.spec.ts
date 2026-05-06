import { test } from '../pages/BasePage';
import { HomePage } from '../pages/HomePage';


[
  { cat: 'Popular', title: 'Doc', type: 'Movie', genres: 'Animation', fromYear: 2020, toYear: 2022, rating: 1, paging: 'first' },
  { cat: 'Trending', title: 'Doc', type: 'TV Shows', genres: 'Comedy', fromYear: 2020, toYear: 2022, rating: 5, paging: 'next' },
  { cat: 'New Releases', title: 'Doc', type: 'Movie', genres: 'Animation, Comedy', fromYear: 2020, toYear: 2022, rating: 4, paging: 'last' }
].forEach(({ cat, title, type, fromYear, toYear, rating, genres, paging }) => {
  test(`Filter by ${cat}, ${title}, ${type}, ${fromYear}-${toYear}, ${rating}, ${genres}, ${paging}`, async ({ page }) => {
    const home = new HomePage(page);
    // goto home page
    await home.goto();
    //apply filters and verify results
    // select category
    await home.selectCategory(cat);
    // type search query
    await home.typeSearch(title);
    // select type
    await home.selectType(type);
    // select genre
    await home.selectGenre(genres);
    // select year range
    await home.selectYearRange(fromYear, toYear);
    // select rating
    await home.selectRating(rating);
    await home.page.waitForTimeout(1000); // wait for results to load
    // select page
    await home.selectPage(paging);
    // verify results match filters
    await home.verifyResults(cat, title, type, fromYear, toYear, rating, genres);
  });
});

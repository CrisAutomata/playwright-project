
# Overview

## Test Results

Passed  ████████████████████ 120
Failed  ██ 3
Skipped █ 1

To test different filter combinations, we can use test.each to run the same test with different data sets

This allows us to easily add more test cases by simply adding more objects to the array without having to duplicate the test code

Parameters include category, search query, type, genre, year range, rating, and pagination to cover various filter combinations and ensure the filtering functionality works correctly under different scenarios

It's scalable and maintainable as we can easily add more test cases by adding more objects to the array without having to write new test code for each case

Using soft assertions allows us to verify all results and report all failures at the end instead of stopping at the first failure, providing a more comprehensive view of any issues with the filtering functionality across all results.

# Test Report & CI Plan


## ❌ Test Results

All test cases failed (3/3):

### Case 1

```
{
  cat: 'Popular',
  title: 'Doc',
  type: 'Movie',
  genres: 'Animation',
  fromYear: 2020,
  toYear: 2022,
  rating: 1,
  paging: 'first'
}
```

### Case 2

```
{
  cat: 'Trend',
  title: 'Doc',
  type: 'TV Shows',
  genres: 'Comedy',
  fromYear: 2020,
  toYear: 2022,
  rating: 5,
  paging: 'next'
}
```

### Case 3

```
{
  cat: 'Newest',
  title: 'Doc',
  type: 'Movie',
  genres: 'Animation, Comedy',
  fromYear: 2020,
  toYear: 2022,
  rating: 4,
  paging: 'last'
}
```

### Issue Summary

* Filtering functionality is **not working as expected**
* Pagination controls (`first`, `next`, `last`) are **not behaving correctly**

---

## Browser Automation Strategy

To improve test stability, the following Playwright option is used:

```js
{ waitUntil: 'networkidle' }
```

### Why this approach?

* Waits until **no network connections for at least 500ms**
* Ensures:

  * All scripts are loaded
  * UI is fully rendered
  * Reduces flaky test failures

---

## CI Integration Plan

### Pipeline Goals

* Automate test execution
* Ensure reliability across deployments
* Provide test artifacts for analysis

### CI Steps

1. **Trigger**

   * Integrate with deployment pipeline
   * Scheduled nightly runs

2. **Environment Setup**

   * Use Ubuntu VM
   * Install Node.js runtime

3. **Execution Flow**

   ```bash
   git clone <repository>
   cd <project>
   npm install
   npm run test
   ```

4. **Artifacts**

   * Store test results:

     * Playwright built-in reports
     * or Allure reports

---

## Notes / Recommendations

* Investigate:

  * Filter logic (likely mismatch between UI state & query params)
  * Pagination state handling (possible async timing or incorrect selectors)
* Consider adding:

  * Explicit waits for UI state (not just network idle)
  * Assertions on API responses (if applicable)

---

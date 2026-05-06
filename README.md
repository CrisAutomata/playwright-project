test result:
3/3 fails:
  { cat: 'Popular', title: 'Doc', type: 'Movie', genres: 'Animation', fromYear: 2020, toYear: 2022, rating: 1, paging: 'first' },
  { cat: 'Trend', title: 'Doc', type: 'TV Shows', genres: 'Comedy', fromYear: 2020, toYear: 2022, rating: 5, paging: 'next' },
  { cat: 'Newest', title: 'Doc', type: 'Movie', genres: 'Animation, Comedy', fromYear: 2020, toYear: 2022, rating: 4, paging: 'last' }

  The filter and the paging is not work as expect


browser API usage:
I have used { waitUntil: 'networkidle' } to ensure page is fully loaded before performing any actions because the networkidle event is triggered when there are no more than 0 network connections for at least 500 ms, it ensures that all resources (like images, scripts, etc.) are fully loaded before the test continues. This can help prevent flaky tests that might occur if the test tries to interact with elements that haven't fully loaded yet.



plan with CI:
-integrate with env deploy pipeline
-run schedully at night 
-step: select vm(Ubuntu), set up node runtime, clone code, install dependencies, run command, save artifact: test-result(Playwright built-in or Allure)
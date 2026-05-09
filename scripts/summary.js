const fs = require('fs');
const path = require('path');

const REPORT_PATH = path

if (!fs.existsSync(REPORT_PATH)) {
    console.error('Cannot find test-results.json');
    process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

console.log('cwd:', process.cwd());
console.log('files:', fs.readdirSync(process.cwd()));

let passed = 0;
let failed = 0;
let skipped = 0;
let duration = 0;

function walkSuites(suites) {
    for (const suite of suites || []) {

        // nested suites
        walkSuites(suite.suites);

        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {

                duration += test.results?.reduce(
                    (sum, r) => sum + (r.duration || 0),
                    0
                ) || 0;

                const status = test.results?.[test.results.length - 1]?.status;

                if (status === 'passed') passed++;
                else if (status === 'failed') failed++;
                else if (status === 'skipped') skipped++;
            }
        }
    }
}

walkSuites(report.suites);

function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;

    return `${min}m ${remainSec}s`;
}

const markdown = `
# Playwright Test Summary

| Metric | Value |
|---|---|
| ✅ Passed | ${passed} |
| ❌ Failed | ${failed} |
| ⏭ Skipped | ${skipped} |
| ⏱ Duration | ${formatDuration(duration)} |

---

## Report

- [Open Playwright HTML Report](./playwright-report/index.html)
`;

if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        markdown
    );

    console.log('Summary written to GitHub Actions summary');
} else {
    console.log(markdown);
}
import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_PATH = path.resolve(
    __dirname,
    '../test-results.json'
);

if (!fs.existsSync(REPORT_PATH)) {
    console.error('Cannot find test-results.json');
    process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

let passed = 0;
let failed = 0;
let skipped = 0;

const failedTests = [];
const slowTests = [];

function walkSuites(suites, parent = '') {
    for (const suite of suites || []) {

        const currentSuite = parent
            ? `${parent} > ${suite.title}`
            : suite.title;

        walkSuites(suite.suites, currentSuite);

        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {

                const lastResult =
                    test.results?.[test.results.length - 1];

                const duration =
                    test.results?.reduce(
                        (sum, r) => sum + (r.duration || 0),
                        0
                    ) || 0;

                const status = lastResult?.status;

                const testName =
                    `${currentSuite} > ${spec.title}`
                        .replace(/^ > /, '');

                if (status === 'passed') passed++;
                else if (status === 'failed') failed++;
                else if (status === 'skipped') skipped++;

                slowTests.push({
                    name: testName,
                    duration,
                });

                if (status === 'failed') {
                    failedTests.push({
                        name: testName,
                        error:
                            lastResult?.error?.message ||
                            'Unknown error',
                    });
                }
            }
        }
    }
}

walkSuites(report.suites);

slowTests.sort((a, b) => b.duration - a.duration);

function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) {
        return `${h}h ${m}m ${s}s`;
    }

    return `${m}m ${s}s`;
}

async function generateSummary() {

    // Title
    core.summary.addHeading('MOA Test Summary');

    //Summary Ditribution
    core.summary.addHeading('Distribution', 2)
    const total = passed + failed + skipped;

    const WIDTH = 20; // total squares in the bar
    const passSquares = Math.round((passed / total) * WIDTH);
    const failSquares = Math.round((failed / total) * WIDTH);
    const skipSquares = WIDTH - passSquares - failSquares;

    const passPct = ((passed / total) * 100).toFixed(2);
    const failPct = ((failed / total) * 100).toFixed(2);
    const skipPct = ((skipped / total) * 100).toFixed(2);


    core.summary.addRaw(`Passing Rate: ${passPct}%\n`);
    core.summary
        .addRaw(`►${'🟩'.repeat(passSquares)} ${passPct}% Passed\n\n`)
        .addRaw(`►${'🟥'.repeat(failSquares)} ${failPct}% Failed\n`)
        .addRaw(`►${'🟨'.repeat(skipSquares)} ${skipPct}% Skipped\n`)
        .write();

    // Summary table
    core.summary.addHeading('Summary Table', 2);
    core.summary.addTable([
        [
            { data: 'Total', header: true },
            { data: '✅ Passed', header: true },
            { data: '♦️ Failed', header: true },
            { data: '🟠 Skipped', header: true },
        ],
        [
            ` ${total}`,
            ` ${passed}`,
            ` ${failed}`,
            ` ${skipped}`,
        ],
        [
            `100%`,
            ` ${(passed / total) * 100}%`,
            ` ${(failed / total) * 100}%`,
            ` ${(skipped / total) * 100}%`,
        ],

    ]);

    // Stack traces
    if (failedTests.length > 0) {

        core.summary.addHeading('Stack Traces', 2);

        for (const test of failedTests) {

            core.summary.addRaw(`
<details>
<summary>${test.name}</summary>

\`\`\`text
${test.error}
\`\`\`

</details>
`);
        }
    }

    // // Persistent Failures
    // core.summary.addHeading('Persistent Failures', 2);

    // if (failedTests.length === 0) {
    //     core.summary.addRaw('✅ No failed tests\n');
    // } else {
    //     core.summary.addList(
    //         failedTests.map(t => t.name)
    //     );
    // }

    // Top Slow Tests
    core.summary.addHeading('Top Slow Tests', 2);
    core.summary.addTable([
        [
            { data: 'Test', header: true },
            { data: 'Duration', header: true },
        ],
        ...slowTests
            .slice(0, 5)
            .map(t => [
                t.name,
                formatDuration(t.duration),
            ]),
    ]);



    // await core.summary.write();
}





generateSummary();
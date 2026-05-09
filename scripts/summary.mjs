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
    core.summary.addHeading('Playwright Test Summary');

    // Summary table
    core.summary.addHeading('Summary Table', 2);

    const total = passed + failed + skipped;

    core.summary.addTable([
        [
            { data: 'Total', header: true },
            { data: '🟢 Passed', header: true },
            { data: '🔴 Failed', header: true },
            { data: '🟡 Skipped', header: true },
        ],
        [
            ` ${total}`,
            ` ${passed}(${((passed / total) * 100).toFixed(1)}%)`,
            ` ${failed}(${((failed / total) * 100).toFixed(1)}%)`,
            ` ${skipped}(${((skipped / total) * 100).toFixed(1)}%)`,
        ],
    ]);

    // Persistent Failures
    core.summary.addHeading('Persistent Failures', 2);

    if (failedTests.length === 0) {
        core.summary.addRaw('✅ No failed tests\n');
    } else {
        core.summary.addList(
            failedTests.map(t => t.name)
        );
    }

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

    await core.summary.write();
}

function createBar(passed, failed, skipped) {
    function createBar(value, max, color = '🟩') {
        const width = 20;

        const filled =
            Math.round((value / max) * width);

        return color.repeat(filled);
    }

    const max = Math.max(
        passed,
        failed,
        skipped
    );

    const markdown = `
## Test Results

Passed  ${createBar(passed, max, '🟩')} ${passed}
Failed  ${createBar(failed, max, '🟥')} ${failed}
Skipped ${createBar(skipped, max, '🟨')} ${skipped}
`;
}

function createPieChart({
    passed,
    failed,
    skipped = 0,
    size = 180,
}) {

    const total =
        passed + failed + skipped;

    if (total === 0) {
        return '<p>No test data</p>';
    }

    const passedDeg =
        (passed / total) * 360;

    const failedDeg =
        (failed / total) * 360;

    const skippedDeg =
        (skipped / total) * 360;

    return `
  <div style="
    display:flex;
    align-items:center;
    gap:24px;
    font-family:sans-serif;
  ">

    <!-- PIE -->
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:
        conic-gradient(
          #22c55e 0deg ${passedDeg}deg,
          #ef4444 ${passedDeg}deg ${passedDeg + failedDeg}deg,
          #facc15 ${passedDeg + failedDeg}deg 360deg
        );
      position:relative;
    ">

      <!-- INNER HOLE -->
      <div style="
        position:absolute;
        inset:22%;
        background:white;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-direction:column;
        font-weight:bold;
      ">
        <div style="font-size:28px;">
          ${total}
        </div>

        <div style="
          font-size:12px;
          color:#666;
        ">
          TOTAL
        </div>
      </div>
    </div>

    <!-- LEGEND -->
    <div style="
      display:flex;
      flex-direction:column;
      gap:10px;
      font-size:14px;
    ">

      <div style="
        display:flex;
        align-items:center;
        gap:8px;
      ">
        <div style="
          width:12px;
          height:12px;
          border-radius:999px;
          background:#22c55e;
        "></div>

        <strong>${passed}</strong> Passed
      </div>

      <div style="
        display:flex;
        align-items:center;
        gap:8px;
      ">
        <div style="
          width:12px;
          height:12px;
          border-radius:999px;
          background:#ef4444;
        "></div>

        <strong>${failed}</strong> Failed
      </div>

      <div style="
        display:flex;
        align-items:center;
        gap:8px;
      ">
        <div style="
          width:12px;
          height:12px;
          border-radius:999px;
          background:#facc15;
        "></div>

        <strong>${skipped}</strong> Skipped
      </div>

    </div>
  </div>
  `;
}

generateSummary();
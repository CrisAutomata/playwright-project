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

    core.summary.addTable([
        [
            { data: 'Suite', header: true },
            { data: '🟢 Passed', header: true },
            { data: '🔴 Failed', header: true },
            { data: '🟡 Skipped', header: true },
        ],
        [
            'E2E Tests',
            ` ${passed}`,
            ` ${failed}`,
            ` ${skipped}`,
        ],
    ]);

    // barchart
    core.summary.addHeading('Test Results', 2);
    core.summary.addRaw(`
<table>
  <tr>
    <td
      style="
        background:#ef4444;
        color:white;
        padding:6px 12px;
        border-radius:6px 0 0 6px;
      "
    >
      ${failed}
    </td>

    <td
      style="
        background:#22c55e;
        color:white;
        padding:6px 120px;
        border-radius:0 6px 6px 0;
      "
    >
      ${passed}
    </td>
  </tr>
</table>
`, true);

    // // Mermaid pie chart
    // core.summary.addHeading('Result Chart', 2);

    // core.summary.addCodeBlock(`
    // pie
    //     title Test Results
    //     "Passed" : ${passed}
    //     "Failed" : ${failed}
    //     "Skipped" : ${skipped}
    // `, 'mermaid');

    //piechart
    core.summary
        .addHeading('Test Results', 2)
        .addRaw(
            createPieChart({
                passed,
                failed,
                skipped,
            })
            , true
        );


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

function createBar(passed, failed) {

    const total = passed + failed;

    const passedPercent =
        (passed / total) * 100;

    const failedPercent =
        (failed / total) * 100;

    return `
  <div style="
    width: 400px;
    height: 28px;
    display: flex;
    overflow: hidden;
    border-radius: 8px;
    font-weight: 600;
    font-family: sans-serif;
  ">
    <div style="
      width: ${failedPercent}%;
      background: #ef4444;
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
    ">
      ${failed}
    </div>

    <div style="
      width: ${passedPercent}%;
      background: #22c55e;
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
    ">
      ${passed}
    </div>
  </div>
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
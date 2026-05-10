import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_PATH = path.resolve(
    __dirname,
    '../test-results/test-results.json'
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


    //Summary Ditribution

    const total = passed + failed + skipped;

    let output = "";
    const width = 15;
    const height = 5;

    const totalSquares = width * height; // total squares in the bar
    const passSquares = Math.round((passed / total) * totalSquares);
    const failSquares = Math.round((failed / total) * totalSquares);
    const skipSquares = totalSquares - passSquares - failSquares;

    const blocks = [
        ...Array(passSquares).fill("🟩"),
        ...Array(failSquares).fill("🟥"),
        ...Array(skipSquares).fill("🟨"),
    ];

    const passPct = ((passed / total) * 100).toFixed(2);
    const failPct = ((failed / total) * 100).toFixed(2);
    const skipPct = ((skipped / total) * 100).toFixed(2);


    // core.summary
    //     .addRaw(`▶︎${'🟩'.repeat(passSquares)}`)
    //     .addRaw(`▶︎${'🟥'.repeat(failSquares)}`)
    //     .addRaw(`▶︎${'🟨'.repeat(skipSquares)}`)
    //     .write();


    for (let i = 0; i < height - 1; i++) {
        const row = blocks.slice(i * width, (i + 1) * width).join("");
        if (i === 0) {
            output += `${row}\n`;
        }
        output += row + "\n";
    }

    // > 80%: healthy
    // > 60%: warning
    // < 60%: require attention
    // < 40%: bad
    let health = "";
    let compare = "";
    if (passPct > 80) {
        health = "Healthy 😊💚";
        compare = "> 80%";
    } else if (passPct > 60) {
        health = "Under_the_weather 🤒🧡";
        compare = "< 80%";
    } else if (passPct > 40) {
        health = "Fever 😵‍💫❤️‍🩹";
        compare = "< 60%";
    } else {
        health = "Emergency 🚑🚨";
        compare = "< 40%";
    }


    // Title
    core.summary.addHeading(`MOA Test Summary: ${health}`, 1);
    core.summary.addRaw('\n\n');
    core.summary.addCodeBlock(
        `Passed: ${passPct}% 🟩 ${compare} (${health})
Failed: ${failPct}% 🟥
Skipped: ${skipPct}% 🟨`
        , 'javascript');
    core.summary.addRaw(output).write();
    core.summary.addRaw('\n');


    core.summary.addHeading('Overview', 3);
    core.summary.addTable([
        [
            { data: 'Status', header: true },
            { data: 'Count', header: true },
            { data: 'Rate', header: true },
        ],
        [
            { data: '✅ Passed', header: true },
            { data: ` ${passed}` },
            { data: ` ${passPct}%` },
        ],
        [
            { data: '❌ Failed', header: true },
            { data: ` ${failed}` },
            { data: ` ${failPct}%` },
        ],
        [
            { data: '⏩ Skipped', header: true },
            { data: ` ${skipped}` },
            { data: ` ${skipPct}%` },
        ],
        [
            { data: 'Total', header: true },
            { data: ` ${total}` },
            { data: '100%' },
        ],

    ]);




    //     // Stack traces
    //     if (failedTests.length > 0) {

    //         core.summary.addHeading('Stack Traces', 2);

    //         for (const test of failedTests) {

    //             core.summary.addRaw(`
    // <details>
    // <summary>${test.name}</summary>

    // \`\`\`text
    // ${test.error}
    // \`\`\`

    // </details>
    // `);
    //         }
    //     }

    // // Persistent Failures
    // core.summary.addHeading('Persistent Failures', 2);

    // if (failedTests.length === 0) {
    //     core.summary.addRaw('✅ No failed tests\n');
    // } else {
    //     core.summary.addList(
    //         failedTests.map(t => t.name)
    //     );
    // }

    // // Top Slow Tests
    // core.summary.addHeading('Top Slow Tests', 2);
    // core.summary.addTable([
    //     [
    //         { data: 'Test', header: true },
    //         { data: 'Duration', header: true },
    //     ],
    //     ...slowTests
    //         .slice(0, 5)
    //         .map(t => [
    //             t.name,
    //             formatDuration(t.duration),
    //         ]),
    // ]);



    // await core.summary.write();
}





generateSummary();
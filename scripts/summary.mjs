import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_PATH = path.resolve(__dirname, '../test-results.json');

if (!fs.existsSync(REPORT_PATH)) {
    console.error('Cannot find test-results.json at', REPORT_PATH);
    process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// Strip ANSI escape codes (\u001b[2m, \u001b[31m, etc.) — without this,
// the stack traces in the summary look like garbage.
function stripAnsi(str = '') {
    // eslint-disable-next-line no-control-regex
    return String(str).replace(/\u001b\[[0-9;]*m/g, '');
}

function escapeHtml(s = '') {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeMd(s = '') {
    return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatDuration(ms) {
    if (!ms || ms < 1000) return `${Math.round(ms || 0)}ms`;
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// Build a normalized signature for an error so similar errors group together.
// Strip variable bits: numbers, quoted strings, file paths, line numbers.
function errorSignature(message) {
    const clean = stripAnsi(message).split('\n')[0]; // first line only
    return clean
        .replace(/"[^"]*"/g, '"…"')        // quoted strings → "…"
        .replace(/\b\d+\b/g, 'N')           // numbers → N
        .replace(/\s+/g, ' ')
        .trim();
}

// ─────────────────────────────────────────────────────────────
// Walk the Playwright JSON report
// ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
let flaky = 0;

const failedTests = [];      // each: { name, file, retries, errors[], primaryError }
const suiteStats = new Map(); // file → { passed, failed, skipped, total }

function bumpSuite(file, status) {
    if (!suiteStats.has(file)) {
        suiteStats.set(file, { passed: 0, failed: 0, skipped: 0, total: 0 });
    }
    const s = suiteStats.get(file);
    s.total++;
    if (status === 'passed') s.passed++;
    else if (status === 'failed' || status === 'timedOut') s.failed++;
    else if (status === 'skipped') s.skipped++;
}

function walkSuites(suites, parent = '', file = '') {
    for (const suite of suites || []) {
        const currentFile = suite.file || file;
        const currentSuite = parent ? `${parent} > ${suite.title}` : suite.title;
        walkSuites(suite.suites, currentSuite, currentFile);

        for (const spec of suite.specs || []) {
            const specFile = spec.file || currentFile;
            for (const test of spec.tests || []) {
                const lastResult = test.results?.[test.results.length - 1];
                const status = lastResult?.status;
                const retries = (test.results?.length || 1) - 1;
                const testName = `${currentSuite} > ${spec.title}`.replace(/^ > /, '');

                if (status === 'passed') {
                    passed++;
                    if (retries > 0) flaky++;
                } else if (status === 'failed' || status === 'timedOut') {
                    failed++;
                } else if (status === 'skipped') {
                    skipped++;
                }
                bumpSuite(specFile, status);

                if (status === 'failed' || status === 'timedOut') {
                    // Collect all the errors (Playwright's expect.soft accumulates many).
                    const allErrors = (lastResult?.errors || []).map(e =>
                        stripAnsi(e?.message || ''),
                    );
                    failedTests.push({
                        name: testName,
                        file: specFile,
                        retries,
                        primaryError: stripAnsi(lastResult?.error?.message || allErrors[0] || 'Unknown error'),
                        errors: allErrors,
                    });
                }
            }
        }
    }
}

walkSuites(report.suites);

const total = passed + failed + skipped;
const totalDuration = report.stats?.duration ?? 0;
const passRate = total > 0 ? (passed / total) * 100 : 0;
const passPct = total > 0 ? (passed / total) * 100 : 0;
const failPct = total > 0 ? (failed / total) * 100 : 0;
const skipPct = total > 0 ? (skipped / total) * 100 : 0;

// ─────────────────────────────────────────────────────────────
// Group failure errors across all failed tests by signature
// ─────────────────────────────────────────────────────────────

const errorGroups = new Map(); // signature → { sample, count, tests:Set }

for (const t of failedTests) {
    for (const errMsg of t.errors) {
        const sig = errorSignature(errMsg);
        if (!errorGroups.has(sig)) {
            errorGroups.set(sig, { sample: errMsg, count: 0, tests: new Set() });
        }
        const g = errorGroups.get(sig);
        g.count++;
        g.tests.add(t.name);
    }
    // If a test has zero per-assertion errors but still failed, fall back to primary.
    if (t.errors.length === 0 && t.primaryError) {
        const sig = errorSignature(t.primaryError);
        if (!errorGroups.has(sig)) {
            errorGroups.set(sig, { sample: t.primaryError, count: 0, tests: new Set() });
        }
        const g = errorGroups.get(sig);
        g.count++;
        g.tests.add(t.name);
    }
}

const sortedErrorGroups = [...errorGroups.entries()].sort(
    (a, b) => b[1].count - a[1].count,
);

// ─────────────────────────────────────────────────────────────
// SVG: segmented bar chart matching the reference image
// ─────────────────────────────────────────────────────────────

function buildBarChartSvg() {
    if (total === 0) {
        return '<p><em>No tests recorded.</em></p>';
    }

    const SQUARES = 30;          // total squares
    const SQ = 32;                // square size px
    const GAP = 6;                // gap between squares
    const RADIUS = 5;             // rounded corners

    // Allocate squares proportionally — never let a non-zero category be 0.
    function alloc(count) {
        if (count === 0) return 0;
        return Math.max(1, Math.round((count / total) * SQUARES));
    }
    let pSq = alloc(passed);
    let fSq = alloc(failed);
    let sSq = alloc(skipped);
    // Reconcile rounding so the squares sum to exactly SQUARES.
    let diff = SQUARES - (pSq + fSq + sSq);
    while (diff !== 0) {
        if (diff > 0) {
            // Add to the largest bucket
            if (passed >= failed && passed >= skipped) pSq++;
            else if (failed >= skipped) fSq++;
            else sSq++;
            diff--;
        } else {
            // Remove from the largest bucket (but never drop a non-zero category to 0)
            if (pSq >= fSq && pSq >= sSq && pSq > (passed > 0 ? 1 : 0)) pSq--;
            else if (fSq >= sSq && fSq > (failed > 0 ? 1 : 0)) fSq--;
            else if (sSq > (skipped > 0 ? 1 : 0)) sSq--;
            else break;
            diff++;
        }
    }

    const width = SQUARES * SQ + (SQUARES - 1) * GAP;
    const headerY = 60;
    const barY = 90;
    const height = barY + SQ + 20;

    const COLORS = {
        passed: '#22c55e',
        failed: '#ef4444',
        skipped: '#facc15',
        text: '#1f2937',
        muted: '#6b7280',
    };

    const squares = [];
    let i = 0;
    for (let n = 0; n < pSq; n++, i++) {
        squares.push(`<rect x="${i * (SQ + GAP)}" y="${barY}" width="${SQ}" height="${SQ}" rx="${RADIUS}" fill="${COLORS.passed}"/>`);
    }
    for (let n = 0; n < fSq; n++, i++) {
        squares.push(`<rect x="${i * (SQ + GAP)}" y="${barY}" width="${SQ}" height="${SQ}" rx="${RADIUS}" fill="${COLORS.failed}"/>`);
    }
    for (let n = 0; n < sSq; n++, i++) {
        squares.push(`<rect x="${i * (SQ + GAP)}" y="${barY}" width="${SQ}" height="${SQ}" rx="${RADIUS}" fill="${COLORS.skipped}"/>`);
    }

    // Three legend columns positioned over the bar
    const colPass = width * 0.10;
    const colFail = width * 0.50;
    const colSkip = width * 0.85;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:1100px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <!-- Legend -->
  <g font-size="22" font-weight="600">
    <text x="${colPass}" y="30" fill="${COLORS.text}">✅ Passed</text>
    <text x="${colFail}" y="30" fill="${COLORS.text}">❌ Failed</text>
    <text x="${colSkip}" y="30" fill="${COLORS.text}">⊘ Skipped</text>
  </g>
  <g font-size="26" font-weight="700">
    <text x="${colPass}" y="${headerY}" fill="${COLORS.passed}">${passed}<tspan font-size="16" font-weight="500" fill="${COLORS.muted}"> (${passPct.toFixed(1)}%)</tspan></text>
    <text x="${colFail}" y="${headerY}" fill="${COLORS.failed}">${failed}<tspan font-size="16" font-weight="500" fill="${COLORS.muted}"> (${failPct.toFixed(1)}%)</tspan></text>
    <text x="${colSkip}" y="${headerY}" fill="#ca8a04">${skipped}<tspan font-size="16" font-weight="500" fill="${COLORS.muted}"> (${skipPct.toFixed(1)}%)</tspan></text>
  </g>
  <!-- Bar -->
  <g>${squares.join('')}</g>
</svg>`;
}

// Inline SVG colored dot — reusable for table cells (matches the reference image)
function dot(color) {
    return `<svg width="10" height="10" viewBox="0 0 10 10" style="vertical-align:middle"><circle cx="5" cy="5" r="5" fill="${color}"/></svg>`;
}

// ─────────────────────────────────────────────────────────────
// Build the summary
// ─────────────────────────────────────────────────────────────

async function generateSummary() {
    // Title + run metadata
    core.summary.addHeading('🎭 Playwright Test Report', 1);

    const meta = [];
    if (process.env.GITHUB_REF_NAME) meta.push(`**Branch:** \`${process.env.GITHUB_REF_NAME}\``);
    if (process.env.GITHUB_SHA) meta.push(`**Commit:** \`${process.env.GITHUB_SHA.slice(0, 7)}\``);
    if (process.env.GITHUB_ACTOR) meta.push(`**Actor:** @${process.env.GITHUB_ACTOR}`);
    meta.push(`**Duration:** ${formatDuration(totalDuration)}`);
    core.summary.addRaw(meta.join(' · ') + '\n\n');

    // ── 1. Segmented bar chart (your image 1) ────────────────
    core.summary.addRaw(buildBarChartSvg() + '\n\n');

    // ── 2. Summary table (your image 2) ──────────────────────
    core.summary.addHeading('📊 Summary', 2);
    core.summary.addTable([
        [
            { data: 'Total', header: true },
            { data: `${dot('#22c55e')} Passed`, header: true },
            { data: `${dot('#ef4444')} Failed`, header: true },
            { data: `${dot('#facc15')} Skipped`, header: true },
            { data: `${dot('#f97316')} Flaky`, header: true },
            { data: 'Pass rate', header: true },
            { data: 'Duration', header: true },
        ],
        [
            String(total),
            String(passed),
            String(failed),
            String(skipped),
            String(flaky),
            `${passRate.toFixed(1)}%`,
            formatDuration(totalDuration),
        ],
    ]);

    // ── 3. Per-suite (per-file) breakdown ────────────────────
    core.summary.addHeading('📁 Suite breakdown', 2);
    if (suiteStats.size === 0) {
        core.summary.addRaw('_No suites found._\n\n');
    } else {
        const rows = [...suiteStats.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([file, s]) => {
                const rate = s.total > 0 ? (s.passed / s.total) * 100 : 0;
                const rateColor = rate >= 95 ? '#22c55e' : rate >= 80 ? '#facc15' : '#ef4444';
                return [
                    `\`${escapeMd(file)}\``,
                    String(s.total),
                    String(s.passed),
                    String(s.failed),
                    String(s.skipped),
                    `${dot(rateColor)} **${rate.toFixed(1)}%**`,
                ];
            });

        core.summary.addTable([
            [
                { data: 'Test suite', header: true },
                { data: 'Total', header: true },
                { data: `${dot('#22c55e')} Passed`, header: true },
                { data: `${dot('#ef4444')} Failed`, header: true },
                { data: `${dot('#facc15')} Skipped`, header: true },
                { data: 'Pass rate', header: true },
            ],
            ...rows,
        ]);
    }

    // ── 4. Persistent failures (errors grouped by signature) ─
    core.summary.addHeading('🔁 Persistent failures', 2);
    if (sortedErrorGroups.length === 0) {
        core.summary.addRaw('> ✅ No failures — nice work!\n\n');
    } else {
        core.summary.addRaw(
            `Errors grouped by their signature. The same root cause often produces many ` +
            `assertion errors (especially with \`expect.soft\`), so this view collapses them ` +
            `into the underlying patterns.\n\n`,
        );

        for (const [sig, group] of sortedErrorGroups) {
            const occLabel = group.count === 1 ? '1 occurrence' : `${group.count} occurrences`;
            const testList = [...group.tests];
            const testsLabel =
                testList.length === 1 ? `in 1 test` : `across ${testList.length} tests`;

            core.summary.addRaw(
                [
                    '<details>',
                    `<summary>🔴 <strong>${escapeHtml(sig)}</strong> &nbsp;<code>${occLabel}, ${testsLabel}</code></summary>`,
                    '',
                    '**Sample error:**',
                    '',
                    '```text',
                    group.sample.trim(),
                    '```',
                    '',
                    '**Affected tests:**',
                    '',
                    testList.map(t => `- \`${escapeMd(t)}\``).join('\n'),
                    '',
                    '</details>',
                    '',
                ].join('\n'),
            );
        }
    }

    // ── 5. Stack traces (one per failed test) ────────────────
    core.summary.addHeading('🧵 Stack traces', 2);
    if (failedTests.length === 0) {
        core.summary.addRaw('> ✅ No failed tests.\n\n');
    } else {
        for (const t of failedTests) {
            const errCount = t.errors.length;
            const errLabel =
                errCount > 1 ? ` <code>${errCount} assertion errors</code>` : '';
            core.summary.addRaw(
                [
                    '<details>',
                    `<summary>🔴 <strong>${escapeHtml(t.name)}</strong>${errLabel}</summary>`,
                    '',
                    `**File:** \`${escapeMd(t.file)}\`${t.retries > 0 ? ` &nbsp;·&nbsp; **Retries:** ${t.retries}` : ''}`,
                    '',
                    '```text',
                    t.primaryError.trim(),
                    '```',
                    '',
                    '</details>',
                    '',
                ].join('\n'),
            );
        }
    }

    // ── Footer ───────────────────────────────────────────────
    core.summary.addRaw(
        `\n<sub>Generated by \`scripts/summary.mjs\` · ${new Date().toISOString()}</sub>\n`,
    );

    await core.summary.write();
}

generateSummary().catch((err) => {
    console.error('Failed to generate summary:', err);
    process.exit(1);
});

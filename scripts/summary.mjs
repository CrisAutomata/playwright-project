import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_PATH = path.resolve(__dirname, '../test-results.json');

if (!fs.existsSync(REPORT_PATH)) {
    console.error('Cannot find test-results.json');
    process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

// ─────────────────────────────────────────────────────────────
// Walk the Playwright JSON report
// ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
let flaky = 0;

const failedTests = [];
const slowTests = [];

function walkSuites(suites, parent = '') {
    for (const suite of suites || []) {
        const currentSuite = parent ? `${parent} > ${suite.title}` : suite.title;
        walkSuites(suite.suites, currentSuite);

        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {
                const lastResult = test.results?.[test.results.length - 1];
                const duration =
                    test.results?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
                const status = lastResult?.status;
                const testName = `${currentSuite} > ${spec.title}`.replace(/^ > /, '');
                const retries = (test.results?.length || 1) - 1;

                if (status === 'passed') {
                    passed++;
                    if (retries > 0) flaky++;
                } else if (status === 'failed' || status === 'timedOut') {
                    failed++;
                } else if (status === 'skipped') {
                    skipped++;
                }

                slowTests.push({ name: testName, duration, status });

                if (status === 'failed' || status === 'timedOut') {
                    failedTests.push({
                        name: testName,
                        retries,
                        error:
                            lastResult?.error?.message ||
                            lastResult?.error?.stack ||
                            'Unknown error',
                    });
                }
            }
        }
    }
}

walkSuites(report.suites);
slowTests.sort((a, b) => b.duration - a.duration);

const total = passed + failed + skipped;
const totalDuration = report.stats?.duration ?? slowTests.reduce((s, t) => s + t.duration, 0);
const passRate = total > 0 ? (passed / total) * 100 : 0;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function escapeMd(s = '') {
    return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// Proportional emoji bar — clamps to a fixed width so rows align.
function emojiBar(value, total, char, width = 20) {
    if (total <= 0) return '';
    const filled = Math.max(0, Math.min(width, Math.round((value / total) * width)));
    return char.repeat(filled) || '·';
}

// Tiny duration bar for the slow-tests table (relative to slowest test).
function durationBar(ms, max, width = 12) {
    if (max <= 0) return '';
    const filled = Math.max(1, Math.round((ms / max) * width));
    return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

// Shields.io badge URL — encodes label/message/color.
function badge(label, message, color) {
    const enc = (s) => encodeURIComponent(String(s).replace(/-/g, '--').replace(/_/g, '__'));
    return `https://img.shields.io/badge/${enc(label)}-${enc(message)}-${color}?style=flat-square`;
}

// ─────────────────────────────────────────────────────────────
// Build summary
// ─────────────────────────────────────────────────────────────
async function generateSummary() {
    const overallColor = failed > 0 ? 'red' : passed > 0 ? 'brightgreen' : 'lightgrey';
    const overallText = failed > 0 ? 'failing' : passed > 0 ? 'passing' : 'no tests';
    const rateColor =
        passRate >= 95 ? 'brightgreen' : passRate >= 80 ? 'yellow' : 'red';

    // ── Hero: title + status badges ──────────────────────────
    core.summary.addHeading('🎭 Playwright Test Report', 1);

    core.summary.addRaw(
        [
            `![status](${badge('status', overallText, overallColor)})`,
            `![pass rate](${badge('pass rate', `${passRate.toFixed(1)}%`, rateColor)})`,
            `![tests](${badge('tests', total, 'blue')})`,
            `![duration](${badge('duration', formatDuration(totalDuration), 'informational')})`,
            flaky > 0 ? `![flaky](${badge('flaky', flaky, 'orange')})` : '',
        ]
            .filter(Boolean)
            .join(' ') + '\n\n',
    );

    // Run metadata (from GitHub env, when available)
    const meta = [];
    if (process.env.GITHUB_REF_NAME) meta.push(`**Branch:** \`${process.env.GITHUB_REF_NAME}\``);
    if (process.env.GITHUB_SHA) meta.push(`**Commit:** \`${process.env.GITHUB_SHA.slice(0, 7)}\``);
    if (process.env.GITHUB_ACTOR) meta.push(`**Actor:** @${process.env.GITHUB_ACTOR}`);
    if (meta.length) core.summary.addRaw(meta.join(' · ') + '\n\n');

    // ── Summary table ────────────────────────────────────────
    core.summary.addHeading('📊 Summary', 2);
    core.summary.addTable([
        [
            { data: 'Total', header: true },
            { data: '🟢 Passed', header: true },
            { data: '🔴 Failed', header: true },
            { data: '🟡 Skipped', header: true },
            { data: '🟠 Flaky', header: true },
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

    // ── Visual breakdown: emoji bar (renders everywhere) ─────
    core.summary.addHeading('📈 Distribution', 2);
    core.summary.addRaw(
        [
            '```text',
            `Passed   ${emojiBar(passed, total, '🟩')} ${passed}`,
            `Failed   ${emojiBar(failed, total, '🟥')} ${failed}`,
            `Skipped  ${emojiBar(skipped, total, '🟨')} ${skipped}`,
            '```',
            '',
        ].join('\n'),
    );

    // ── Mermaid pie chart (GitHub renders these natively) ────
    if (total > 0) {
        core.summary.addRaw(
            [
                '```mermaid',
                'pie showData',
                '    title Test results',
                `    "Passed"  : ${passed}`,
                `    "Failed"  : ${failed}`,
                `    "Skipped" : ${skipped}`,
                '```',
                '',
            ].join('\n'),
        );
    }

    // ── Failures (each one collapsible w/ its trace) ─────────
    core.summary.addHeading('❌ Failures', 2);
    if (failedTests.length === 0) {
        core.summary.addRaw('> ✅ No failed tests — nice work.\n\n');
    } else {
        for (const t of failedTests) {
            const retryNote = t.retries > 0 ? ` _(after ${t.retries} retr${t.retries === 1 ? 'y' : 'ies'})_` : '';
            core.summary.addRaw(
                [
                    '<details>',
                    `<summary><strong>🔴 ${t.name}</strong>${retryNote}</summary>`,
                    '',
                    '```text',
                    t.error,
                    '```',
                    '',
                    '</details>',
                    '',
                ].join('\n'),
            );
        }
    }

    // ── Top slow tests (with mini duration bar) ──────────────
    core.summary.addHeading('🐢 Top 5 slowest tests', 2);
    const top = slowTests.slice(0, 5);
    if (top.length === 0) {
        core.summary.addRaw('_No tests recorded._\n\n');
    } else {
        const slowest = top[0].duration || 1;
        const statusIcon = (s) =>
            s === 'passed' ? '🟢' : s === 'failed' || s === 'timedOut' ? '🔴' : '🟡';

        core.summary.addTable([
            [
                { data: '#', header: true },
                { data: '', header: true },
                { data: 'Test', header: true },
                { data: 'Duration', header: true },
                { data: '', header: true },
            ],
            ...top.map((t, i) => [
                String(i + 1),
                statusIcon(t.status),
                escapeMd(t.name),
                formatDuration(t.duration),
                `\`${durationBar(t.duration, slowest)}\``,
            ]),
        ]);
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

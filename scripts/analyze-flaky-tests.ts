// SPDX-License-Identifier: FSL-1.1-MIT

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO = 'safe-global/safe-client-gateway';
const WORKFLOW_NAME = 'CI';
const TEST_JOBS = ['unit-tests', 'integration-tests'];
const PERIOD_DAYS = 60;
const PER_PAGE = 100;
const OUTPUT_DIR = path.join(__dirname, '..', 'reports', 'flaky-tests');
const DELAY_MS = 100;

// --- Types ---

interface FailedTest {
  file: string;
  name: string;
  error: string;
}

interface CiRun {
  id: number;
  sha: string;
  branch: string;
  conclusion: string;
  created_at: string;
  failed_jobs: Array<string>;
  failed_tests: Array<FailedTest>;
}

interface FlakyTest {
  file: string;
  failure_count: number;
  is_cascade: boolean;
  status: 'open' | 'fixed';
  fix_pr: { number: number; url: string } | null;
}

interface WeeklyTrend {
  week: string;
  commits: number;
  flaky: number;
  rate: number;
}

interface FixPr {
  number: number;
  title: string;
  url: string;
  merged_at: string | null;
  tests_fixed: Array<string>;
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gh(endpoint: string, params: Record<string, string> = {}): unknown {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = query
    ? `repos/${REPO}/${endpoint}?${query}`
    : `repos/${REPO}/${endpoint}`;
  const result = execSync(`gh api "${url}"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(result);
}

function getDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - PERIOD_DAYS);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// --- Fetchers ---

interface GhWorkflowRun {
  id: number;
  head_sha: string;
  head_branch: string;
  conclusion: string;
  created_at: string;
  name: string;
  event: string;
}

interface GhWorkflowRunsResponse {
  total_count: number;
  workflow_runs: Array<GhWorkflowRun>;
}

async function fetchAllCiRuns(
  from: string,
  to: string,
): Promise<Array<GhWorkflowRun>> {
  const allRuns: Array<GhWorkflowRun> = [];

  // GitHub caps paginated results at 1000, so chunk by 2-week windows
  const chunks: Array<{ from: string; to: string }> = [];
  const startDate = new Date(`${from}T00:00:00Z`);
  const endDate = new Date(`${to}T23:59:59Z`);
  const chunkMs = 14 * 24 * 60 * 60 * 1000; // 14 days

  let chunkStart = new Date(startDate);
  while (chunkStart < endDate) {
    const chunkEnd = new Date(
      Math.min(chunkStart.getTime() + chunkMs, endDate.getTime()),
    );
    chunks.push({
      from: chunkStart.toISOString().split('T')[0],
      to: chunkEnd.toISOString().split('T')[0],
    });
    chunkStart = new Date(chunkEnd.getTime() + 1);
  }

  console.log(`Fetching CI runs in ${chunks.length} date chunks...`);

  const seenIds = new Set<number>();

  for (const chunk of chunks) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = gh('actions/runs', {
        per_page: String(PER_PAGE),
        page: String(page),
        status: 'completed',
        created: `${chunk.from}..${chunk.to}`,
      }) as GhWorkflowRunsResponse;

      const ciRuns = data.workflow_runs.filter(
        (r) => r.name === WORKFLOW_NAME && r.event !== 'release',
      );

      // Deduplicate across chunk boundaries
      let added = 0;
      for (const run of ciRuns) {
        if (!seenIds.has(run.id)) {
          seenIds.add(run.id);
          allRuns.push(run);
          added++;
        }
      }

      console.log(
        `  [${chunk.from}..${chunk.to}] Page ${page}: ${added} new CI runs (${allRuns.length} total)`,
      );

      if (data.workflow_runs.length < PER_PAGE) {
        hasMore = false;
      } else {
        page++;
        await sleep(DELAY_MS);
      }
    }
  }

  return allRuns;
}

interface GhJob {
  id: number;
  name: string;
  conclusion: string;
}

interface GhJobsResponse {
  jobs: Array<GhJob>;
}

function parseFailedTestsFromLog(log: string): Array<FailedTest> {
  const tests: Array<FailedTest> = [];
  const lines = log.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: FAIL src/path/to/file.spec.ts
    const failMatch = line.match(/FAIL (src\/\S+)/);
    if (!failMatch) continue;

    const file = failMatch[1];
    // Look ahead for test name and error
    let testName = '';
    let error = '';

    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const nextLine = lines[j];
      // Strip ANSI codes and timestamp prefix
      const clean = nextLine
        .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/g, '')
        .replace(/\x1b\[[0-9;]*m/g, '')
        .trim();

      // Test name line: starts with bullet
      if (!testName && clean.match(/^[●•]\s/)) {
        testName = clean.replace(/^[●•]\s*/, '');
      }
      // Error message: first non-empty line after test name
      if (testName && !error && clean.length > 0 && !clean.match(/^[●•]/)) {
        error = clean;
        break;
      }
    }

    // Deduplicate (logs sometimes repeat the summary)
    if (!tests.some((t) => t.file === file && t.name === testName)) {
      tests.push({ file, name: testName, error });
    }
  }

  return tests;
}

async function fetchFailedTestDetails(
  runId: number,
): Promise<{ failedJobs: Array<string>; failedTests: Array<FailedTest> }> {
  const jobsData = gh(`actions/runs/${runId}/jobs`) as GhJobsResponse;
  const failedJobs = jobsData.jobs
    .filter(
      (j) => j.conclusion === 'failure' && TEST_JOBS.includes(j.name),
    )
    .map((j) => ({ id: j.id, name: j.name }));

  if (failedJobs.length === 0) {
    return { failedJobs: [], failedTests: [] };
  }

  const allFailedTests: Array<FailedTest> = [];
  const failedJobNames: Array<string> = [];

  for (const job of failedJobs) {
    failedJobNames.push(job.name);
    await sleep(DELAY_MS);

    try {
      const log = execSync(
        `gh api "repos/${REPO}/actions/jobs/${job.id}/logs"`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
      );
      const tests = parseFailedTestsFromLog(log);
      allFailedTests.push(...tests);
    } catch {
      console.warn(`    Warning: Could not fetch logs for job ${job.id}`);
    }
  }

  return { failedJobs: failedJobNames, failedTests: allFailedTests };
}

// --- Analysis ---

function identifyFlakyCommits(
  runs: Array<CiRun>,
): Map<string, { pass: boolean; fail: boolean }> {
  const shaMap = new Map<string, { pass: boolean; fail: boolean }>();

  for (const run of runs) {
    const entry = shaMap.get(run.sha) ?? { pass: false, fail: false };
    if (run.conclusion === 'success') entry.pass = true;
    if (run.conclusion === 'failure' && run.failed_tests.length > 0) {
      entry.fail = true;
    }
    shaMap.set(run.sha, entry);
  }

  return shaMap;
}

function detectCascadeBaseline(
  testFailureCounts: Map<string, number>,
): { baseline: number; cascadeTests: Array<string> } {
  const counts = Array.from(testFailureCounts.values());
  if (counts.length === 0) return { baseline: 0, cascadeTests: [] };

  // Find the most common failure count (mode)
  const freq = new Map<number, number>();
  for (const c of counts) {
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }

  let maxFreq = 0;
  let baseline = 0;
  for (const [count, frequency] of freq) {
    if (frequency > maxFreq && frequency >= 3) {
      maxFreq = frequency;
      baseline = count;
    }
  }

  const cascadeTests = Array.from(testFailureCounts.entries())
    .filter(([, count]) => count === baseline)
    .map(([file]) => file);

  return { baseline, cascadeTests };
}

async function fetchTestFixPrs(): Promise<Array<FixPr>> {
  console.log('Fetching test-related PRs...');
  const prs: Array<FixPr> = [];
  let page = 1;

  // Fetch merged PRs that mention test/flaky/mock/spec in title
  while (page <= 5) {
    const data = gh('pulls', {
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: String(PER_PAGE),
      page: String(page),
    }) as Array<{
      number: number;
      title: string;
      html_url: string;
      merged_at: string | null;
      state: string;
    }>;

    if (data.length === 0) break;

    const testPrs = data.filter((pr) =>
      /test|flaky|mock|spec/i.test(pr.title),
    );

    for (const pr of testPrs) {
      await sleep(DELAY_MS);
      // Fetch files changed in this PR
      try {
        const files = gh(`pulls/${pr.number}/files`, {
          per_page: '100',
        }) as Array<{ filename: string }>;

        const testFiles = files
          .map((f) => f.filename)
          .filter((f) => f.match(/\.spec\.ts$/));

        if (testFiles.length > 0) {
          prs.push({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            merged_at: pr.merged_at,
            tests_fixed: testFiles,
          });
        }
      } catch {
        console.warn(
          `    Warning: Could not fetch files for PR #${pr.number}`,
        );
      }
    }

    page++;
    await sleep(DELAY_MS);
  }

  return prs;
}

// --- Report Generation ---

function generateReport(args: {
  period: { from: string; to: string };
  summary: {
    total_commits: number;
    flaky_commits: number;
    flakiness_rate: number;
  };
  weeklyTrend: Array<WeeklyTrend>;
  tests: Array<FlakyTest>;
  cascadeBaseline: number;
  cascadeTestsCount: number;
  prs: Array<FixPr>;
}): string {
  const lines: Array<string> = [];
  const {
    period,
    summary,
    weeklyTrend,
    tests,
    cascadeBaseline,
    cascadeTestsCount,
    prs,
  } = args;

  lines.push('# Flaky Test Baseline Report');
  lines.push('');
  lines.push(
    `Generated: ${new Date().toISOString()} | Period: ${period.from} to ${period.to}`,
  );
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total unique commits | ${summary.total_commits} |`);
  lines.push(`| Flaky commits (pass + fail on same SHA) | ${summary.flaky_commits} |`);
  lines.push(`| Flakiness rate | ${summary.flakiness_rate}% |`);
  lines.push(
    `| Cascade baseline | ${cascadeBaseline} failures (${cascadeTestsCount} tests) |`,
  );
  lines.push('');

  // Weekly trend
  lines.push('## Weekly Trend');
  lines.push('');
  lines.push('| Week | Commits | Flaky | Rate |');
  lines.push('|------|---------|-------|------|');
  for (const w of weeklyTrend) {
    lines.push(`| ${w.week} | ${w.commits} | ${w.flaky} | ${w.rate}% |`);
  }
  lines.push('');

  // Flaky test leaderboard (above cascade baseline)
  const nonCascade = tests
    .filter((t) => !t.is_cascade)
    .sort((a, b) => b.failure_count - a.failure_count);
  const cascadeTests = tests.filter((t) => t.is_cascade);

  lines.push('## Flaky Test Leaderboard (Non-Cascade)');
  lines.push('');
  if (nonCascade.length === 0) {
    lines.push('No non-cascade flaky tests found.');
  } else {
    lines.push('| File | Failures | Status | Fix PR |');
    lines.push('|------|----------|--------|--------|');
    for (const t of nonCascade) {
      const status = t.status === 'fixed' ? 'Fixed' : 'Open';
      const pr = t.fix_pr
        ? `[#${t.fix_pr.number}](${t.fix_pr.url})`
        : '-';
      lines.push(`| \`${t.file}\` | ${t.failure_count} | ${status} | ${pr} |`);
    }
  }
  lines.push('');

  // Cascade tests (collapsed)
  if (cascadeTests.length > 0) {
    lines.push('## Cascade Tests');
    lines.push('');
    lines.push(
      `These ${cascadeTests.length} tests all failed exactly ${cascadeBaseline} times, suggesting they fail together as a cascade (e.g., shared infrastructure issue).`,
    );
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Click to expand cascade test list</summary>');
    lines.push('');
    for (const t of cascadeTests) {
      lines.push(`- \`${t.file}\``);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // Fix PRs
  lines.push('## Fix PRs');
  lines.push('');
  if (prs.length === 0) {
    lines.push('No test fix PRs found in this period.');
  } else {
    for (const pr of prs) {
      const status = pr.merged_at ? 'Merged' : 'Open';
      lines.push(
        `### [#${pr.number}](${pr.url}) - ${pr.title} (${status})`,
      );
      lines.push('');
      for (const f of pr.tests_fixed) {
        lines.push(`- \`${f}\``);
      }
      lines.push('');
    }
  }

  // Still open flaky tests
  const openTests = tests.filter(
    (t) => t.status === 'open' && !t.is_cascade,
  );
  if (openTests.length > 0) {
    lines.push('## Still-Open Flaky Tests');
    lines.push('');
    for (const t of openTests) {
      lines.push(`- \`${t.file}\` (${t.failure_count} failures)`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*This report was auto-generated by `scripts/analyze-flaky-tests.ts`. ' +
      'It will be superseded by Datadog Test Optimization (WA-1754).*',
  );
  lines.push('');

  return lines.join('\n');
}

// --- Main ---

async function main(): Promise<void> {
  const { from, to } = getDateRange();
  console.log(`Analyzing flaky tests from ${from} to ${to}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('');

  // 1. Fetch all CI runs
  const allGhRuns = await fetchAllCiRuns(from, to);
  console.log(`\nTotal CI runs fetched: ${allGhRuns.length}`);

  // 2. Build run data with failure details
  const runs: Array<CiRun> = [];
  const failedGhRuns = allGhRuns.filter((r) => r.conclusion === 'failure');
  const passedGhRuns = allGhRuns.filter((r) => r.conclusion === 'success');

  console.log(
    `\nFailed runs: ${failedGhRuns.length}, Passed runs: ${passedGhRuns.length}`,
  );

  // Add passed runs (no failure details needed)
  for (const r of passedGhRuns) {
    runs.push({
      id: r.id,
      sha: r.head_sha.substring(0, 7),
      branch: r.head_branch,
      conclusion: 'success',
      created_at: r.created_at,
      failed_jobs: [],
      failed_tests: [],
    });
  }

  // Fetch failure details for failed runs
  console.log('\nFetching failure details...');
  let processed = 0;
  for (const r of failedGhRuns) {
    processed++;
    process.stdout.write(
      `  [${processed}/${failedGhRuns.length}] Run ${r.id}...`,
    );

    const { failedJobs, failedTests } = await fetchFailedTestDetails(r.id);

    runs.push({
      id: r.id,
      sha: r.head_sha.substring(0, 7),
      branch: r.head_branch,
      conclusion: 'failure',
      created_at: r.created_at,
      failed_jobs: failedJobs,
      failed_tests: failedTests,
    });

    if (failedTests.length > 0) {
      console.log(
        ` ${failedJobs.join(', ')} -> ${failedTests.length} test(s)`,
      );
    } else if (failedJobs.length > 0) {
      console.log(` ${failedJobs.join(', ')} (no test failures parsed)`);
    } else {
      console.log(' (non-test failure)');
    }

    await sleep(DELAY_MS);
  }

  // 3. Identify flaky commits (same SHA with both pass + fail = non-deterministic)
  const shaMap = identifyFlakyCommits(runs);
  const uniqueCommits = shaMap.size;
  const flakyCommits = Array.from(shaMap.values()).filter(
    (v) => v.pass && v.fail,
  ).length;
  const flakinessRate =
    uniqueCommits > 0
      ? Math.round((flakyCommits / uniqueCommits) * 1000) / 10
      : 0;

  // Build set of truly flaky SHAs for filtering test counts
  const flakyShas = new Set<string>();
  for (const [sha, state] of shaMap) {
    if (state.pass && state.fail) flakyShas.add(sha);
  }

  console.log(
    `\nFlakiness: ${flakyCommits}/${uniqueCommits} commits = ${flakinessRate}%`,
  );

  // 4. Build test failure counts (only from flaky commits — same SHA passed elsewhere)
  const testFailureCounts = new Map<string, number>();
  for (const run of runs) {
    if (!flakyShas.has(run.sha)) continue;
    for (const test of run.failed_tests) {
      testFailureCounts.set(
        test.file,
        (testFailureCounts.get(test.file) ?? 0) + 1,
      );
    }
  }

  // 5. Detect cascade pattern
  const { baseline: cascadeBaseline, cascadeTests: cascadeTestFiles } =
    detectCascadeBaseline(testFailureCounts);
  console.log(
    `Cascade baseline: ${cascadeBaseline} failures (${cascadeTestFiles.length} tests)`,
  );

  // 6. Fetch test-related PRs
  const fixPrs = await fetchTestFixPrs();
  console.log(`Found ${fixPrs.length} test-related PRs`);

  // 7. Build flaky tests list with PR correlation
  const prFileMap = new Map<string, FixPr>();
  for (const pr of fixPrs) {
    for (const file of pr.tests_fixed) {
      prFileMap.set(file, pr);
    }
  }

  const flakyTests: Array<FlakyTest> = Array.from(
    testFailureCounts.entries(),
  ).map(([file, count]) => {
    const matchedPr = prFileMap.get(file) ?? null;
    const isCascade = cascadeTestFiles.includes(file);
    return {
      file,
      failure_count: count,
      is_cascade: isCascade,
      status: matchedPr?.merged_at ? 'fixed' : 'open',
      fix_pr: matchedPr
        ? { number: matchedPr.number, url: matchedPr.url }
        : null,
    };
  });

  // 8. Build weekly trend (only count truly flaky: same SHA passed + failed)
  const weeklyMap = new Map<
    string,
    { commits: Set<string>; flaky: Set<string> }
  >();
  for (const run of runs) {
    const week = getWeekStart(run.created_at);
    const entry = weeklyMap.get(week) ?? {
      commits: new Set(),
      flaky: new Set(),
    };
    entry.commits.add(run.sha);
    if (flakyShas.has(run.sha)) {
      entry.flaky.add(run.sha);
    }
    weeklyMap.set(week, entry);
  }

  const weeklyTrend: Array<WeeklyTrend> = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, data]) => ({
      week,
      commits: data.commits.size,
      flaky: data.flaky.size,
      rate:
        data.commits.size > 0
          ? Math.round((data.flaky.size / data.commits.size) * 1000) / 10
          : 0,
    }));

  // 9. Write output files
  const now = new Date().toISOString();
  const period = { from, to };

  const ciRunsData = {
    generated_at: now,
    period,
    flaky_shas: Array.from(flakyShas),
    runs: runs
      .filter((r) => r.failed_tests.length > 0 && flakyShas.has(r.sha))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
  };

  const flakyTestsData = {
    generated_at: now,
    summary: {
      total_commits: uniqueCommits,
      flaky_commits: flakyCommits,
      flakiness_rate: flakinessRate,
      period,
    },
    weekly_trend: weeklyTrend,
    tests: flakyTests.sort((a, b) => b.failure_count - a.failure_count),
    cascade_baseline: cascadeBaseline,
    cascade_tests_count: cascadeTestFiles.length,
  };

  const fixPrsData = {
    generated_at: now,
    prs: fixPrs,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'ci-runs.json'),
    JSON.stringify(ciRunsData, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'flaky-tests.json'),
    JSON.stringify(flakyTestsData, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'fix-prs.json'),
    JSON.stringify(fixPrsData, null, 2) + '\n',
  );

  const report = generateReport({
    period,
    summary: {
      total_commits: uniqueCommits,
      flaky_commits: flakyCommits,
      flakiness_rate: flakinessRate,
    },
    weeklyTrend,
    tests: flakyTests,
    cascadeBaseline,
    cascadeTestsCount: cascadeTestFiles.length,
    prs: fixPrs,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log('\nDone! Files written:');
  console.log(`  ${path.join(OUTPUT_DIR, 'ci-runs.json')}`);
  console.log(`  ${path.join(OUTPUT_DIR, 'flaky-tests.json')}`);
  console.log(`  ${path.join(OUTPUT_DIR, 'fix-prs.json')}`);
  console.log(`  ${path.join(OUTPUT_DIR, 'REPORT.md')}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

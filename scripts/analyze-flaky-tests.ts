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

function getDateRange(resumeAfter?: string | null): {
  from: string;
  to: string;
} {
  const to = new Date();
  const toStr = to.toISOString().split('T')[0];

  if (resumeAfter) {
    // Resume from 1 day before last check to catch in-progress runs
    const resume = new Date(resumeAfter);
    resume.setDate(resume.getDate() - 1);
    return { from: resume.toISOString().split('T')[0], to: toStr };
  }

  const from = new Date(to);
  from.setDate(from.getDate() - PERIOD_DAYS);
  return { from: from.toISOString().split('T')[0], to: toStr };
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// --- Incremental support ---

interface ExistingData {
  lastCheckedAt: string;
  runs: Array<CiRun>;
  periodFrom: string;
  weeklyTrend: Array<WeeklyTrend>;
  testCounts: Map<string, number>;
  cascadeBaseline: number;
  cascadeTestsCount: number;
}

function loadExistingData(): ExistingData | null {
  const ciRunsPath = path.join(OUTPUT_DIR, 'ci-runs.json');
  const flakyTestsPath = path.join(OUTPUT_DIR, 'flaky-tests.json');
  if (!fs.existsSync(ciRunsPath) || !fs.existsSync(flakyTestsPath)) {
    return null;
  }

  try {
    const ciData = JSON.parse(fs.readFileSync(ciRunsPath, 'utf-8'));
    const flakyData = JSON.parse(fs.readFileSync(flakyTestsPath, 'utf-8'));

    const lastCheckedAt =
      ciData.last_checked_at ?? ciData.generated_at ?? null;
    if (!lastCheckedAt) return null;

    const runs: Array<CiRun> = ciData.runs ?? [];
    const periodFrom: string = ciData.period?.from ?? '';
    const weeklyTrend: Array<WeeklyTrend> = flakyData.weekly_trend ?? [];
    const testCounts = new Map<string, number>();
    for (const t of flakyData.tests ?? []) {
      testCounts.set(t.file, t.failure_count);
    }

    return {
      lastCheckedAt,
      runs,
      periodFrom,
      weeklyTrend,
      testCounts,
      cascadeBaseline: flakyData.cascade_baseline ?? 0,
      cascadeTestsCount: flakyData.cascade_tests_count ?? 0,
    };
  } catch (err) {
    console.warn('Could not load existing data, starting fresh:', err);
    return null;
  }
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
  // Load existing data for incremental mode
  const existing = loadExistingData();
  const { from, to } = getDateRange(existing?.lastCheckedAt);

  if (existing) {
    console.log(
      `Incremental mode: resuming from ${existing.lastCheckedAt}`,
    );
    console.log(`Existing data: ${existing.runs.length} flaky runs, ` +
      `${existing.weeklyTrend.length} weekly rows`);
  } else {
    console.log('Full mode: no existing data found');
  }
  console.log(`Fetching runs from ${from} to ${to}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // 1. Fetch CI runs for the date range
  const allGhRuns = await fetchAllCiRuns(from, to);
  console.log(`\nCI runs fetched: ${allGhRuns.length}`);

  // 2. Deduplicate against existing runs
  const existingRunIds = new Set(existing?.runs.map((r) => r.id) ?? []);
  const newGhRuns = allGhRuns.filter((r) => !existingRunIds.has(r.id));
  const skipped = allGhRuns.length - newGhRuns.length;
  if (skipped > 0) {
    console.log(`Skipping ${skipped} already-processed runs`);
  }
  console.log(`New runs to process: ${newGhRuns.length}`);

  // 3. Build run data with failure details for new runs only
  const runs: Array<CiRun> = [];
  const failedGhRuns = newGhRuns.filter((r) => r.conclusion === 'failure');
  const passedGhRuns = newGhRuns.filter((r) => r.conclusion === 'success');

  console.log(
    `\nNew failed: ${failedGhRuns.length}, New passed: ${passedGhRuns.length}`,
  );

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

  if (failedGhRuns.length > 0) {
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
  }

  // 4. Analyze new runs for flakiness
  const shaMap = identifyFlakyCommits(runs);
  const newFlakyShas = new Set<string>();
  for (const [sha, state] of shaMap) {
    if (state.pass && state.fail) newFlakyShas.add(sha);
  }

  const newUniqueCommits = shaMap.size;
  const newFlakyCommits = newFlakyShas.size;
  console.log(
    `\nNew period flakiness: ${newFlakyCommits}/${newUniqueCommits} commits`,
  );

  // 5. Build test failure counts for new period
  const newTestCounts = new Map<string, number>();
  for (const run of runs) {
    if (!newFlakyShas.has(run.sha)) continue;
    for (const test of run.failed_tests) {
      newTestCounts.set(
        test.file,
        (newTestCounts.get(test.file) ?? 0) + 1,
      );
    }
  }

  // 6. Detect cascade in new data
  detectCascadeBaseline(newTestCounts);

  // 7. Merge with existing data
  // Merge flaky runs (append new, deduplicate by id)
  const mergedRuns = [...(existing?.runs ?? [])];
  const mergedRunIds = new Set(mergedRuns.map((r) => r.id));
  for (const run of runs) {
    if (
      run.failed_tests.length > 0 &&
      newFlakyShas.has(run.sha) &&
      !mergedRunIds.has(run.id)
    ) {
      mergedRuns.push(run);
    }
  }
  mergedRuns.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Merge flaky SHAs
  const mergedFlakyShas = new Set([
    ...(existing?.runs.map((r) => r.sha) ?? []),
    ...newFlakyShas,
  ]);

  // Merge weekly trend (keep existing weeks, add new ones)
  const existingWeeks = new Set(
    existing?.weeklyTrend.map((w) => w.week) ?? [],
  );
  const newWeeklyMap = new Map<
    string,
    { commits: Set<string>; flaky: Set<string> }
  >();
  for (const run of runs) {
    const week = getWeekStart(run.created_at);
    if (existingWeeks.has(week)) continue;
    const entry = newWeeklyMap.get(week) ?? {
      commits: new Set(),
      flaky: new Set(),
    };
    entry.commits.add(run.sha);
    if (newFlakyShas.has(run.sha)) {
      entry.flaky.add(run.sha);
    }
    newWeeklyMap.set(week, entry);
  }
  const newWeeklyRows: Array<WeeklyTrend> = Array.from(
    newWeeklyMap.entries(),
  ).map(([week, data]) => ({
    week,
    commits: data.commits.size,
    flaky: data.flaky.size,
    rate:
      data.commits.size > 0
        ? Math.round((data.flaky.size / data.commits.size) * 1000) / 10
        : 0,
  }));
  const mergedWeeklyTrend = [
    ...(existing?.weeklyTrend ?? []),
    ...newWeeklyRows,
  ].sort((a, b) => a.week.localeCompare(b.week));

  // Merge test failure counts
  const mergedTestCounts = new Map(existing?.testCounts ?? []);
  for (const [file, count] of newTestCounts) {
    mergedTestCounts.set(
      file,
      (mergedTestCounts.get(file) ?? 0) + count,
    );
  }

  // Re-detect cascade on merged counts
  const {
    baseline: finalCascadeBaseline,
    cascadeTests: finalCascadeFiles,
  } = detectCascadeBaseline(mergedTestCounts);
  console.log(
    `Merged cascade baseline: ${finalCascadeBaseline} failures (${finalCascadeFiles.length} tests)`,
  );

  // Compute merged summary
  const mergedTotalCommits = mergedWeeklyTrend.reduce(
    (sum, w) => sum + w.commits,
    0,
  );
  const mergedFlakyCommits = mergedWeeklyTrend.reduce(
    (sum, w) => sum + w.flaky,
    0,
  );
  const mergedFlakinessRate =
    mergedTotalCommits > 0
      ? Math.round(
          (mergedFlakyCommits / mergedTotalCommits) * 1000,
        ) / 10
      : 0;

  // 8. Fetch test-related PRs (always re-fetch, cheap)
  const fixPrs = await fetchTestFixPrs();
  console.log(`Found ${fixPrs.length} test-related PRs`);

  // 9. Build flaky tests list with PR correlation
  const prFileMap = new Map<string, FixPr>();
  for (const pr of fixPrs) {
    for (const file of pr.tests_fixed) {
      prFileMap.set(file, pr);
    }
  }

  const flakyTests: Array<FlakyTest> = Array.from(
    mergedTestCounts.entries(),
  ).map(([file, count]) => {
    const matchedPr = prFileMap.get(file) ?? null;
    const isCascade = finalCascadeFiles.includes(file);
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

  // 10. Write output files
  const now = new Date().toISOString();
  const periodFrom = existing?.periodFrom ?? from;
  const period = { from: periodFrom, to };

  const ciRunsData = {
    generated_at: now,
    last_checked_at: now,
    period,
    flaky_shas: Array.from(mergedFlakyShas),
    runs: mergedRuns,
  };

  const flakyTestsData = {
    generated_at: now,
    summary: {
      total_commits: mergedTotalCommits,
      flaky_commits: mergedFlakyCommits,
      flakiness_rate: mergedFlakinessRate,
      period,
    },
    weekly_trend: mergedWeeklyTrend,
    tests: flakyTests.sort((a, b) => b.failure_count - a.failure_count),
    cascade_baseline: finalCascadeBaseline,
    cascade_tests_count: finalCascadeFiles.length,
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
      total_commits: mergedTotalCommits,
      flaky_commits: mergedFlakyCommits,
      flakiness_rate: mergedFlakinessRate,
    },
    weeklyTrend: mergedWeeklyTrend,
    tests: flakyTests,
    cascadeBaseline: finalCascadeBaseline,
    cascadeTestsCount: finalCascadeFiles.length,
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

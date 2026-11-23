// SPDX-License-Identifier: FSL-1.1-MIT

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const REPO = "safe-global/safe-client-gateway";
// Workflows running the test gate: ci.yml until 2026-09-29, then the PR gate
// plus the trunk pipeline (staging.yml, renamed devstaging.yml on 2026-10-05).
const CI_WORKFLOWS = new Set(
	["ci.yml", "pull-request.yml", "staging.yml", "devstaging.yml"].map(
		(f) => `.github/workflows/${f}`,
	),
);
// Matches "unit-tests" and reusable-workflow names like "ci / integration-tests (1/3)"
const TEST_JOB = /(^|\/ )(unit|integration)-tests( \(\d+\/\d+\))?$/;
// PRs referencing this ticket count as flake work even when they fix no recorded flake
const FLAKY_TICKET = "WA-1753";
const PERIOD_DAYS = 60;
const PER_PAGE = 100;
const OUTPUT_DIR = path.join(__dirname, "..", "reports", "flaky-tests");
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
	last_failure: string;
	status: "open" | "in_review" | "fixed" | "removed";
	fix_pr: { number: number; url: string } | null;
}

interface WeeklyTrend {
	week: string;
	commits: number;
	flaky: number;
	rate: number;
	// Commits first seen after the week's last flaky commit
	clean_tail?: number;
}

interface FixPr {
	number: number;
	title: string;
	url: string;
	merged_at: string | null;
	state: "open" | "closed" | "merged";
	tests_fixed: Array<string>;
	refs_ticket?: boolean;
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// gh api with retries: a single transient network error (e.g. connection
// reset) must not kill a multi-minute run.
function ghExec(cmd: string): string {
	const maxAttempts = 3;
	for (let attempt = 1; ; attempt++) {
		try {
			return execSync(cmd, {
				encoding: "utf-8",
				maxBuffer: 50 * 1024 * 1024,
			});
		} catch (err) {
			if (attempt >= maxAttempts) throw err;
			console.warn(
				`    Warning: gh call failed (attempt ${attempt}/${maxAttempts}), retrying...`,
			);
			execSync("sleep 2");
		}
	}
}

function gh(endpoint: string, params: Record<string, string> = {}): unknown {
	const query = Object.entries(params)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join("&");
	const url = query
		? `repos/${REPO}/${endpoint}?${query}`
		: `repos/${REPO}/${endpoint}`;
	return JSON.parse(ghExec(`gh api "${url}"`));
}

// Throws if `origin/main` is missing rather than marking every test removed
execSync("git rev-parse --verify -q origin/main", { stdio: "ignore" });
const TARGET_RATE = 0.005;
const WINDOW_WEEKS = 4;
const TREND_SVG = "trend.svg";

function windowStats(trend: Array<WeeklyTrend>, i: number, t: number) {
	const rows = trend.slice(Math.max(0, i - WINDOW_WEEKS + 1), i + 1);
	const n = rows.reduce((s, w) => s + w.commits, 0);
	const k = rows.reduce((s, w) => s + w.flaky, 0);
	return { n, k, conf: confidenceBelow(n, k, t) };
}

// Two panels on one week axis (one y-scale each): weekly flake rate bars with
// target rate lines, and the rolling confidence of staying under each target.
function renderTrendSvg(trend: Array<WeeklyTrend>): string {
	const W = 960;
	const left = 56;
	const right = 150;
	const plotW = W - left - right;
	const top1 = 96;
	const h1 = 260;
	const top2 = top1 + h1 + 72;
	const h2 = 170;
	const H = top2 + h2 + 40;
	const STEP = 5; // rate axis grid in %
	const maxRate =
		Math.ceil(Math.max(STEP, ...trend.map((w) => w.rate)) / STEP) * STEP;
	const targets = [
		{ rate: 1, cls: "ref" },
		{ rate: 0.5, cls: "main" },
		{ rate: 0.1, cls: "ref dash" },
	];
	const bw = plotW / Math.max(trend.length, 1);
	const x = (i: number) => left + i * bw;
	const y1 = (r: number) => top1 + h1 - (r / maxRate) * h1;
	const y2 = (c: number) => top2 + h2 - c * h2;
	// Right-edge labels: lift each one so close values don't overlap
	const labels = (items: Array<{ y: number; text: string; main: boolean }>) => {
		items.sort((a, b) => b.y - a.y);
		for (let i = 1; i < items.length; i++) {
			items[i].y = Math.min(items[i].y, items[i - 1].y - 14);
		}
		return items.map(
			(e) =>
				`<text ${e.main ? 'class="lbl-main" ' : ""}x="${left + plotW + 8}" y="${e.y + 4}">${e.text}</text>`,
		);
	};
	const out: Array<string> = [];
	out.push(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif">`,
		"<style>",
		":root{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e4e3df;--bar:#2a78d6;--main:#eb6834}",
		"@media (prefers-color-scheme: dark){:root{--bg:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#3a3a37;--bar:#3987e5;--main:#d95926}}",
		"text{fill:var(--ink2);font-size:12px}.title{fill:var(--ink);font-size:16px;font-weight:600}.h{fill:var(--ink);font-size:13px;font-weight:600}",
		".grid{stroke:var(--grid);stroke-width:1}.bar{fill:var(--bar)}.faint{opacity:.35}",
		".ref{stroke:var(--ink2);stroke-width:1.5;fill:none}.dash{stroke-dasharray:5 4}.main{stroke:var(--main);stroke-width:2.5;fill:none}",
		".lbl-main{fill:var(--main);font-weight:600}",
		"</style>",
		`<rect width="${W}" height="${H}" fill="var(--bg)"/>`,
		`<text class="title" x="${left}" y="28">CGW CI flakiness by week</text>`,
		`<text x="${left}" y="48">Target lines: <tspan class="lbl-main">━ 0.5% (target)</tspan>   ━ 1%   ╍ 0.1%   ·   faded bars: weeks with &lt;10 commits</text>`,
		`<text class="h" x="${left}" y="${top1 - 22}">Flaky commits per week (% of commits)</text>`,
	);
	for (let r = 0; r <= maxRate; r += STEP) {
		out.push(
			`<line class="grid" x1="${left}" x2="${left + plotW}" y1="${y1(r)}" y2="${y1(r)}"/>`,
			`<text x="${left - 8}" y="${y1(r) + 4}" text-anchor="end">${r}%</text>`,
		);
	}
	trend.forEach((w, i) => {
		const h = top1 + h1 - y1(w.rate);
		const bx = x(i) + 1;
		const bwid = Math.max(bw - 2, 1);
		const tip = `<title>${w.week}: ${w.flaky}/${w.commits} commits flaky (${w.rate}%)</title>`;
		if (h > 0) {
			const rr = Math.min(4, bwid / 2, h);
			out.push(
				`<path class="bar${w.commits < 10 ? " faint" : ""}" d="M${bx} ${top1 + h1}V${y1(w.rate) + rr}q0 -${rr} ${rr} -${rr}H${bx + bwid - rr}q${rr} 0 ${rr} ${rr}V${top1 + h1}Z">${tip}</path>`,
			);
		}
	});
	for (const t of targets) {
		out.push(
			`<line class="${t.cls}" x1="${left}" x2="${left + plotW}" y1="${y1(t.rate)}" y2="${y1(t.rate)}"/>`,
		);
	}
	out.push(
		...labels(
			targets.map((t) => ({
				y: y1(t.rate),
				text: `${t.rate}%${t.cls === "main" ? " target" : ""}`,
				main: t.cls === "main",
			})),
		),
		`<text class="h" x="${left}" y="${top2 - 14}">Confidence the flake rate is below each target (last ${WINDOW_WEEKS} weeks)</text>`,
	);
	for (const c of [0, 0.5, 1]) {
		out.push(
			`<line class="grid" x1="${left}" x2="${left + plotW}" y1="${y2(c)}" y2="${y2(c)}"/>`,
		);
		// 100% sits next to the 95% marker, so it stays unlabelled
		if (c < 1) {
			out.push(
				`<text x="${left - 8}" y="${y2(c) + 4}" text-anchor="end">${c * 100}%</text>`,
			);
		}
	}
	out.push(
		`<line class="ref dash" x1="${left}" x2="${left + plotW}" y1="${y2(0.95)}" y2="${y2(0.95)}" opacity=".6"/>`,
		`<text x="${left - 8}" y="${y2(0.95) + 4}" text-anchor="end" font-size="10">95%</text>`,
	);
	const ends: Array<{ y: number; text: string; main: boolean }> = [];
	for (const t of targets) {
		const pts = trend.map((_, i) => {
			const conf = windowStats(trend, i, t.rate / 100).conf;
			return { cx: x(i) + bw / 2, cy: y2(conf), conf };
		});
		const d = pts.map((p, i) => `${i ? "L" : "M"}${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join("");
		out.push(`<path class="${t.cls}" d="${d}"/>`);
		const last = pts[pts.length - 1];
		if (last) {
			ends.push({
				y: last.cy,
				text: `&lt;${t.rate}%: ${Math.round(last.conf * 100)}%`,
				main: t.cls === "main",
			});
		}
	}
	out.push(...labels(ends));
	let month = "";
	trend.forEach((w, i) => {
		const m = new Date(`${w.week}T00:00:00Z`).toLocaleString("en", {
			month: "short",
			timeZone: "UTC",
		});
		if (m === month) return;
		month = m;
		out.push(
			`<text x="${x(i)}" y="${top2 + h2 + 20}">${m}</text>`,
			`<line class="grid" x1="${x(i)}" x2="${x(i)}" y1="${top2 + h2}" y2="${top2 + h2 + 6}"/>`,
		);
	});
	out.push("</svg>");
	return `${out.join("\n")}\n`;
}

// P(rate < t) after k flaky of n commits with a uniform prior,
// i.e. P(Binomial(n + 1, t) >= k + 1)
function confidenceBelow(n: number, k: number, t: number): number {
	let p = (1 - t) ** (n + 1);
	let cdf = 0;
	for (let i = 0; i <= k; i++) {
		cdf += p;
		p *= ((n + 1 - i) / (i + 1)) * (t / (1 - t));
	}
	return Math.max(0, 1 - cdf);
}

// A failed lookup counts as included, so an unknown failure keeps a test open
function commitIncludesPr(sha: string, prNumber: number): boolean {
	try {
		const pr = gh(`pulls/${prNumber}`) as { merge_commit_sha: string };
		const cmp = gh(`compare/${pr.merge_commit_sha}...${sha}`) as {
			status: string;
		};
		return cmp.status === "ahead" || cmp.status === "identical";
	} catch {
		return true;
	}
}

function existsOnMain(file: string): boolean {
	try {
		execSync(`git cat-file -e "origin/main:${file}"`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function getDateRange(resumeAfter?: string | null): {
	from: string;
	to: string;
} {
	const to = new Date();
	const toStr = to.toISOString().split("T")[0];

	if (resumeAfter) {
		// Resume from the Monday of the last-checked week, or 1 day before the
		// last check if that is earlier (to catch in-progress runs). Covering
		// the whole current week lets the weekly trend rebuild its still-open
		// row instead of freezing it at the previous run's mid-week state.
		const resume = new Date(resumeAfter);
		resume.setUTCDate(resume.getUTCDate() - 1);
		const weekStart = new Date(`${getWeekStart(resumeAfter)}T00:00:00Z`);
		const fromDate = resume < weekStart ? resume : weekStart;
		return { from: fromDate.toISOString().split("T")[0], to: toStr };
	}

	const from = new Date(to);
	from.setDate(from.getDate() - PERIOD_DAYS);
	return { from: from.toISOString().split("T")[0], to: toStr };
}

function getWeekStart(dateStr: string): string {
	// UTC throughout — local-time weekdays put Sunday-evening runs into
	// spurious extra rows next to the real Monday-keyed week.
	const date = new Date(dateStr);
	const day = date.getUTCDay();
	date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
	return date.toISOString().split("T")[0];
}

// --- Incremental support ---

interface ExistingData {
	lastCheckedAt: string;
	runs: Array<CiRun>;
	periodFrom: string;
	weeklyTrend: Array<WeeklyTrend>;
	testCounts: Map<string, number>;
}

function loadExistingData(): ExistingData | null {
	const ciRunsPath = path.join(OUTPUT_DIR, "ci-runs.json");
	const flakyTestsPath = path.join(OUTPUT_DIR, "flaky-tests.json");
	if (!fs.existsSync(ciRunsPath) || !fs.existsSync(flakyTestsPath)) {
		return null;
	}

	try {
		const ciData = JSON.parse(fs.readFileSync(ciRunsPath, "utf-8"));
		const flakyData = JSON.parse(fs.readFileSync(flakyTestsPath, "utf-8"));

		const lastCheckedAt = ciData.last_checked_at ?? ciData.generated_at ?? null;
		if (!lastCheckedAt) return null;

		const runs: Array<CiRun> = ciData.runs ?? [];
		const periodFrom: string = ciData.period?.from ?? "";
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
		};
	} catch (err) {
		console.warn("Could not load existing data, starting fresh:", err);
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
	path: string;
	event: string;
	run_attempt: number;
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

	// GitHub caps paginated results at 1000 across all workflows, so chunk by
	// 2-day windows
	const chunks: Array<{ from: string; to: string }> = [];
	const startDate = new Date(`${from}T00:00:00Z`);
	const endDate = new Date(`${to}T23:59:59Z`);
	const chunkMs = 2 * 24 * 60 * 60 * 1000; // 2 days

	let chunkStart = new Date(startDate);
	while (chunkStart < endDate) {
		const chunkEnd = new Date(
			Math.min(chunkStart.getTime() + chunkMs, endDate.getTime()),
		);
		chunks.push({
			from: chunkStart.toISOString().split("T")[0],
			to: chunkEnd.toISOString().split("T")[0],
		});
		chunkStart = new Date(chunkEnd.getTime() + 1);
	}

	console.log(`Fetching CI runs in ${chunks.length} date chunks...`);

	const seenIds = new Set<number>();

	for (const chunk of chunks) {
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			const data = gh("actions/runs", {
				per_page: String(PER_PAGE),
				page: String(page),
				status: "completed",
				created: `${chunk.from}..${chunk.to}`,
			}) as GhWorkflowRunsResponse;

			const ciRuns = data.workflow_runs.filter(
				// The report branch's own pushes run a stale ci.yml and always fail
				(r) =>
					CI_WORKFLOWS.has(r.path) &&
					r.event !== "release" &&
					r.head_branch !== "reports/flaky-tests-baseline",
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
			} else if (page * PER_PAGE >= 1000) {
				throw new Error(`${chunk.from}..${chunk.to} hit the 1000-run cap`);
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
	// Files flagged as failed by the Vitest per-file summary; used as a
	// fallback when no "Failed Tests" block was parsed for them.
	const vitestSummaryFiles = new Set<string>();

	// Strip the GitHub log timestamp prefix and ANSI colour codes before any
	// matching: Vitest wraps FAIL in colour codes, so raw lines never match.
	const lines = log.split("\n").map((l) =>
		l
			.replace(/\r$/, "")
			.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI colour codes
			.replace(/\x1b\[[0-9;]*m/g, ""),
	);

	const addTest = (file: string, name: string, error: string): void => {
		// Deduplicate (logs sometimes repeat the summary)
		if (!tests.some((t) => t.file === file && t.name === name)) {
			tests.push({ file, name, error });
		}
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Vitest "Failed Tests" block:
		//   FAIL  unit src/path/to/file.spec.ts > Suite > test name
		const vitestFailMatch = line.match(
			/\bFAIL\s+(?:unit|integration|e2e)\s+(src\/\S+\.spec\.ts)(?:\s+>\s+(.+))?$/,
		);
		if (vitestFailMatch) {
			const file = vitestFailMatch[1];
			const name = vitestFailMatch[2]?.trim() ?? "";
			// Error message: first non-empty line after the FAIL line. Failures
			// sharing one error are grouped as consecutive FAIL lines with the
			// error after the last one, so skip sibling FAIL lines; a ⎯ divider
			// means the block ended without an error line.
			let error = "";
			for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
				const clean = lines[j].trim();
				if (clean.length === 0) continue;
				if (/^FAIL\s+(?:unit|integration|e2e)\s+src\//.test(clean)) continue;
				if (clean.startsWith("⎯")) break;
				error = clean;
				break;
			}
			addTest(file, name, error);
			continue;
		}

		// Vitest per-file summary (file only, robust fallback):
		//   ❯ unit src/path/to/file.spec.ts (2 tests | 1 failed) 17ms
		const vitestSummaryMatch = line.match(
			/❯\s+(?:unit|integration|e2e)\s+(src\/\S+\.spec\.ts)\s+\(\d+ tests?\s*\|\s*\d+ failed\)/,
		);
		if (vitestSummaryMatch) {
			vitestSummaryFiles.add(vitestSummaryMatch[1]);
			continue;
		}

		// Jest — only reached by logs predating the Vitest migration (#3136,
		// merged 2026-06-23). Safe to delete once the analysis window starts
		// after that date (from ~2026-09 even a from-scratch 60-day rebuild
		// sees only Vitest logs).
		//   FAIL src/path/to/file.spec.ts
		const jestFailMatch = line.match(/FAIL (src\/\S+)/);
		if (!jestFailMatch) continue;

		const file = jestFailMatch[1];
		// Look ahead for test name and error
		let testName = "";
		let error = "";

		for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
			const clean = lines[j].trim();

			// Test name line: starts with bullet
			if (!testName && clean.match(/^[●•]\s/)) {
				testName = clean.replace(/^[●•]\s*/, "");
			}
			// Error message: first non-empty line after test name
			if (testName && !error && clean.length > 0 && !clean.match(/^[●•]/)) {
				error = clean;
				break;
			}
		}

		addTest(file, testName, error);
	}

	// Summary said the file failed, but no "Failed Tests" block was parsed
	// for it (e.g. the block was truncated) — record the file alone.
	for (const file of vitestSummaryFiles) {
		if (!tests.some((t) => t.file === file)) {
			tests.push({ file, name: "", error: "" });
		}
	}

	return tests;
}

async function fetchFailedTestDetails(
	runId: number,
	opts: { allAttempts?: boolean } = {},
): Promise<{ failedJobs: Array<string>; failedTests: Array<FailedTest> }> {
	// allAttempts includes jobs of earlier run attempts: a run whose final
	// attempt succeeded can still carry failed test jobs from a re-run.
	const jobsData = gh(`actions/runs/${runId}/jobs`, {
		per_page: "100",
		...(opts.allAttempts ? { filter: "all" } : {}),
	}) as GhJobsResponse;
	const failedJobs = jobsData.jobs
		.filter((j) => j.conclusion === "failure" && TEST_JOB.test(j.name))
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
			const log = ghExec(
				`gh api --allow-escape-sequences "repos/${REPO}/actions/jobs/${job.id}/logs"`,
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
		if (run.conclusion === "success") entry.pass = true;
		if (run.conclusion === "failure" && run.failed_tests.length > 0) {
			entry.fail = true;
		}
		shaMap.set(run.sha, entry);
	}

	return shaMap;
}

function prState(pr: {
	state: string;
	merged_at: string | null;
}): FixPr["state"] {
	if (pr.merged_at) return "merged";
	return pr.state === "open" ? "open" : "closed";
}

async function fetchTestFixPrs(): Promise<Array<FixPr>> {
	console.log("Fetching test-related PRs...");
	const prs: Array<FixPr> = [];
	let page = 1;

	// Fetch PRs that mention test/flaky/mock/spec in the title, or carry a
	// `Flaky-Test:` marker or the flaky-test ticket in the body
	while (page <= 5) {
		const data = gh("pulls", {
			state: "all",
			sort: "updated",
			direction: "desc",
			per_page: String(PER_PAGE),
			page: String(page),
		}) as Array<{
			number: number;
			title: string;
			html_url: string;
			merged_at: string | null;
			state: string;
			body: string | null;
		}>;

		if (data.length === 0) break;

		const testPrs = data.filter(
			(pr) =>
				/test|flaky|mock|spec/i.test(pr.title) ||
				/^Flaky-Test:/im.test(pr.body ?? "") ||
				(pr.body ?? "").includes(FLAKY_TICKET),
		);

		for (const pr of testPrs) {
			await sleep(DELAY_MS);
			// Fetch files changed in this PR
			try {
				const files = gh(`pulls/${pr.number}/files`, {
					per_page: "100",
				}) as Array<{ filename: string }>;

				// Changed spec files are a heuristic that misses fixes made in
				// source, helper or config files; a spec named in the body (path
				// or basename, e.g. a `Flaky-Test:` marker) links it regardless.
				const bodySpecs = Array.from(
					(pr.body ?? "").matchAll(/[\w./-]+\.spec\.ts/g),
					(m) => m[0],
				);
				const testFiles = [
					...new Set([
						// A change to `x.ts` counts for its unit spec `x.spec.ts`
						...files
							.map((f) =>
								f.filename.replace(/(?<!\.spec)\.ts$/, ".spec.ts"),
							)
							.filter((f) => f.match(/\.spec\.ts$/)),
						...bodySpecs,
					]),
				];
				const refsTicket = (pr.body ?? "").includes(FLAKY_TICKET);

				if (testFiles.length > 0 || refsTicket) {
					prs.push({
						number: pr.number,
						title: pr.title,
						url: pr.html_url,
						merged_at: pr.merged_at,
						state: prState(pr),
						tests_fixed: testFiles,
						refs_ticket: refsTicket,
					});
				}
			} catch {
				console.warn(`    Warning: Could not fetch files for PR #${pr.number}`);
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
	prs: Array<FixPr>;
}): string {
	const lines: Array<string> = [];
	const { period, summary, weeklyTrend, tests, prs } = args;
	const target = `<${TARGET_RATE * 100}%`;
	const windowAt = (i: number) => windowStats(weeklyTrend, i, TARGET_RATE);
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const latest = windowAt(weeklyTrend.length - 1);
	// Chance a fixed test would have failed again since its fix had the fix not
	// worked: its failure rate before the fix week, over the commits after it.
	const fixConfidence = (t: FlakyTest): string => {
		const merged = prs.find((p) => p.number === t.fix_pr?.number)?.merged_at;
		if (t.status !== "fixed" || !merged) return "-";
		const sum = (rows: Array<WeeklyTrend>) =>
			rows.reduce((s, w) => s + w.commits, 0);
		const mergeWeek = weeklyTrend.findLastIndex(
			(w) => w.week <= merged.slice(0, 10),
		);
		const before = sum(weeklyTrend.slice(0, mergeWeek));
		const after = sum(weeklyTrend.slice(mergeWeek + 1));
		if (before === 0) return "-";
		const rate = Math.min(1, t.failure_count / before);
		return pct(1 - (1 - rate) ** after);
	};

	lines.push("# Flaky Test Baseline Report");
	lines.push("");
	lines.push(
		`Generated: ${new Date().toISOString()} | Period: ${period.from} to ${period.to}`,
	);
	lines.push("");

	// Summary
	lines.push("## Summary");
	lines.push("");
	lines.push(`| Metric | Value |`);
	lines.push(`|--------|-------|`);
	lines.push(
		`| **Confidence flake rate ${target}** (last ${WINDOW_WEEKS} weeks) | **${pct(latest.conf)}** (${latest.k} flaky / ${latest.n} commits) |`,
	);
	lines.push(`| Total unique commits | ${summary.total_commits} |`);
	lines.push(
		`| Flaky commits (pass + fail on same SHA) | ${summary.flaky_commits} |`,
	);
	lines.push(`| Flakiness rate | ${summary.flakiness_rate}% |`);
	lines.push("");
	lines.push(
		"Since 2026-06-04 a commit also counts as flaky when a failed attempt " +
			"was recovered by re-running the same workflow run (GitHub reports " +
			"only the final attempt, so this signal needs a per-attempt lookup). " +
			"Earlier weeks lack that signal and understate flakiness.",
	);
	lines.push("");
	lines.push(
		`Confidence is the probability that the per-commit flake rate is ${target}, ` +
			`given the flaky and total commits of the last ${WINDOW_WEEKS} weeks ` +
			"(binomial model, uniform prior). Flakes nobody re-ran are not seen, " +
			"so the true confidence is somewhat lower.",
	);
	lines.push("");

	// Weekly trend: chart (written next to the report), table as the text view
	lines.push("## Weekly Trend");
	lines.push("");
	lines.push(`![Weekly flake rate and confidence](${TREND_SVG})`);
	lines.push("");
	lines.push("<details>");
	lines.push("<summary>Weekly numbers</summary>");
	lines.push("");
	lines.push(`| Week | Commits | Flaky | Rate | Confidence ${target} (${WINDOW_WEEKS} wk) |`);
	lines.push("|------|---------|-------|------|------|");
	weeklyTrend.forEach((w, i) => {
		lines.push(
			`| ${w.week} | ${w.commits} | ${w.flaky} | ${w.rate}% | ${pct(windowAt(i).conf)} |`,
		);
	});
	lines.push("");
	lines.push("</details>");
	lines.push("");

	// Clean-streak tracker: commits first seen after the last flaky commit.
	// Rule of three: 0 flakes in n commits bounds the true rate below 3/n at
	// 95% confidence, so the target rate needs a 3/TARGET_RATE-commit streak.
	const needed = Math.round(3 / TARGET_RATE);
	let cleanStreak = 0;
	for (let i = weeklyTrend.length - 1; i >= 0; i--) {
		const w = weeklyTrend[i];
		cleanStreak += w.flaky > 0 ? (w.clean_tail ?? 0) : w.commits;
		if (w.flaky > 0) break;
	}
	lines.push("## Clean Streak");
	lines.push("");
	if (cleanStreak >= needed) {
		lines.push(
			`**Target met:** ${cleanStreak} commits without a flake — the flake rate is below ${(300 / cleanStreak).toFixed(2)}% at 95% confidence (target: ${target}).`,
		);
	} else if (cleanStreak > 0) {
		lines.push(
			`${cleanStreak} commits without a flake since the last flake — ` +
				`rate is below ${(300 / cleanStreak).toFixed(1)}% at 95% confidence. ` +
				`Target ${target} at 95% needs a **${needed}-commit** streak (${needed - cleanStreak} to go).`,
		);
	} else {
		lines.push(
			`Streak broken: the most recent commit flaked. Target ${target} at 95% needs a ${needed}-commit clean streak.`,
		);
	}
	lines.push("");

	// Flaky test leaderboard
	const statusLabel = {
		open: "Open",
		in_review: "Fix in review",
		fixed: "Fixed",
		removed: "Removed from main",
	};
	lines.push("## Flaky Test Leaderboard");
	lines.push("");
	if (tests.length === 0) {
		lines.push("No flaky tests found.");
	} else {
		lines.push(
			"| File | Failures | Last failure | Status | Fix PR | Fix confidence |",
		);
		lines.push(
			"|------|----------|--------------|--------|--------|----------------|",
		);
		for (const t of [...tests].sort(
			(a, b) => b.failure_count - a.failure_count,
		)) {
			const pr = t.fix_pr ? `[#${t.fix_pr.number}](${t.fix_pr.url})` : "-";
			lines.push(
				`| \`${t.file}\` | ${t.failure_count} | ${t.last_failure.slice(0, 10)} | ${statusLabel[t.status]} | ${pr} | ${fixConfidence(t)} |`,
			);
		}
	}
	lines.push("");

	// Fix PRs
	lines.push("## Fix PRs");
	lines.push("");
	if (prs.length === 0) {
		lines.push("No test fix PRs found in this period.");
	} else {
		for (const pr of prs) {
			const status = { open: "Open", closed: "Closed", merged: "Merged" }[
				pr.state
			];
			lines.push(`- [#${pr.number}](${pr.url}) - ${pr.title} (${status})`);
		}
		lines.push("");
	}

	// Merged flake work that fixed no recorded flaky test
	const fixNumbers = new Set(tests.map((t) => t.fix_pr?.number));
	const prevention = prs
		.filter((pr) => pr.refs_ticket && pr.merged_at && !fixNumbers.has(pr.number))
		.sort((a, b) => (b.merged_at ?? "").localeCompare(a.merged_at ?? ""));
	if (prevention.length > 0) {
		lines.push("## Prevention PRs");
		lines.push("");
		lines.push(
			`Merged PRs referencing ${FLAKY_TICKET} that fix a latent flake before it showed up in CI.`,
		);
		lines.push("");
		lines.push("| PR | Title | Merged |");
		lines.push("|----|-------|--------|");
		for (const pr of prevention) {
			lines.push(
				`| [#${pr.number}](${pr.url}) | ${pr.title} | ${pr.merged_at?.slice(0, 10)} |`,
			);
		}
		lines.push("");
	}

	// Still open flaky tests
	const openTests = tests.filter((t) => t.status === "open");
	if (openTests.length > 0) {
		lines.push("## Still-Open Flaky Tests");
		lines.push("");
		for (const t of openTests) {
			lines.push(
				`- \`${t.file}\` (${t.failure_count} failures, last ${t.last_failure.slice(0, 10)})`,
			);
		}
		lines.push("");
	}

	lines.push("---");
	lines.push("");
	lines.push(
		"*This report was auto-generated by `scripts/analyze-flaky-tests.ts`.*",
	);
	lines.push("");

	return lines.join("\n");
}

// --- Main ---

async function main(): Promise<void> {
	// Load existing data for incremental mode
	const existing = loadExistingData();
	const { from, to } = getDateRange(existing?.lastCheckedAt);

	if (existing) {
		console.log(`Incremental mode: resuming from ${existing.lastCheckedAt}`);
		console.log(
			`Existing data: ${existing.runs.length} flaky runs, ` +
				`${existing.weeklyTrend.length} weekly rows`,
		);
	} else {
		console.log("Full mode: no existing data found");
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
	const failedGhRuns = newGhRuns.filter((r) => r.conclusion === "failure");
	const passedGhRuns = newGhRuns.filter((r) => r.conclusion === "success");

	console.log(
		`\nNew failed: ${failedGhRuns.length}, New passed: ${passedGhRuns.length}`,
	);

	const rerunRecovered = passedGhRuns.filter((r) => r.run_attempt > 1);
	if (rerunRecovered.length > 0) {
		console.log(
			`\nChecking earlier attempts of ${rerunRecovered.length} re-run-recovered run(s)...`,
		);
	}

	for (const r of passedGhRuns) {
		runs.push({
			id: r.id,
			sha: r.head_sha.substring(0, 7),
			branch: r.head_branch,
			conclusion: "success",
			created_at: r.created_at,
			failed_jobs: [],
			failed_tests: [],
		});

		// A success on attempt >1 means an earlier attempt failed and a re-run
		// recovered it — the canonical flake. The runs API only reports the
		// final attempt, so pull failed test jobs across all attempts and
		// record the earlier failure against the same SHA.
		if (r.run_attempt > 1) {
			const { failedJobs, failedTests } = await fetchFailedTestDetails(r.id, {
				allAttempts: true,
			});
			if (failedTests.length > 0) {
				runs.push({
					// Keep the real run id: only this failure record is persisted,
					// and the id then shields the run from incremental re-processing
					// (which would double-count its tests).
					id: r.id,
					sha: r.head_sha.substring(0, 7),
					branch: r.head_branch,
					conclusion: "failure",
					created_at: r.created_at,
					failed_jobs: failedJobs,
					failed_tests: failedTests,
				});
				console.log(
					`  Run ${r.id} (attempt ${r.run_attempt}): earlier attempt failed ` +
						`${failedJobs.join(", ")} -> ${failedTests.length} test(s)`,
				);
			}
			await sleep(DELAY_MS);
		}
	}

	if (failedGhRuns.length > 0) {
		console.log("\nFetching failure details...");
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
				conclusion: "failure",
				created_at: r.created_at,
				failed_jobs: failedJobs,
				failed_tests: failedTests,
			});

			if (failedTests.length > 0) {
				console.log(
					` ${failedJobs.join(", ")} -> ${failedTests.length} test(s)`,
				);
			} else if (failedJobs.length > 0) {
				console.log(` ${failedJobs.join(", ")} (no test failures parsed)`);
			} else {
				console.log(" (non-test failure)");
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
			newTestCounts.set(test.file, (newTestCounts.get(test.file) ?? 0) + 1);
		}
	}

	// 6. Merge with existing data
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

	// Merge weekly trend: rows from the last-checked week onward are rebuilt
	// from this fetch — the window reaches back to that week's Monday, so the
	// data covers them completely and still-open weeks don't freeze at a
	// mid-week state. Older rows are kept as-is. The rebuild iterates over
	// allGhRuns (not just new runs) because already-processed runs must still
	// count into the rebuilt weeks.
	const rebuildFromWeek = existing ? getWeekStart(existing.lastCheckedAt) : "";
	// Legacy rows keyed to a Sunday came from local-time week starts and belong
	// to the next Monday's week
	const keptByWeek = new Map<string, WeeklyTrend>();
	for (const w of existing?.weeklyTrend ?? []) {
		if (w.week >= rebuildFromWeek) continue;
		const d = new Date(`${w.week}T00:00:00Z`);
		if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
		const week = d.toISOString().split("T")[0];
		const commits = (keptByWeek.get(week)?.commits ?? 0) + w.commits;
		const flaky = (keptByWeek.get(week)?.flaky ?? 0) + w.flaky;
		const rate = commits ? Math.round((flaky / commits) * 1000) / 10 : 0;
		keptByWeek.set(week, {
			week,
			commits,
			flaky,
			rate,
			clean_tail: w.clean_tail,
		});
	}
	const keptWeekly = [...keptByWeek.values()];
	const keptWeeks = new Set(keptWeekly.map((w) => w.week));
	// Per week: each commit's first run time, and which commits flaked
	const newWeeklyMap = new Map<
		string,
		{ firstSeen: Map<string, string>; flaky: Set<string> }
	>();
	for (const run of allGhRuns) {
		if (run.conclusion !== "success" && run.conclusion !== "failure") continue;
		const week = getWeekStart(run.created_at);
		if (keptWeeks.has(week)) continue;
		const sha = run.head_sha.substring(0, 7);
		const entry = newWeeklyMap.get(week) ?? {
			firstSeen: new Map(),
			flaky: new Set(),
		};
		const seen = entry.firstSeen.get(sha);
		if (!seen || run.created_at < seen) entry.firstSeen.set(sha, run.created_at);
		if (mergedFlakyShas.has(sha)) {
			entry.flaky.add(sha);
		}
		newWeeklyMap.set(week, entry);
	}
	const newWeeklyRows: Array<WeeklyTrend> = Array.from(
		newWeeklyMap.entries(),
	).map(([week, data]) => {
		const commits = data.firstSeen.size;
		const lastFlake =
			[...data.flaky]
				.map((sha) => data.firstSeen.get(sha) ?? "")
				.sort()
				.at(-1) ?? "";
		return {
			week,
			commits,
			flaky: data.flaky.size,
			rate: commits > 0 ? Math.round((data.flaky.size / commits) * 1000) / 10 : 0,
			clean_tail: [...data.firstSeen.values()].filter((t) => t > lastFlake)
				.length,
		};
	});
	const mergedWeeklyTrend = [...keptWeekly, ...newWeeklyRows].sort((a, b) =>
		a.week.localeCompare(b.week),
	);

	// Merge test failure counts
	const mergedTestCounts = new Map(existing?.testCounts ?? []);
	for (const [file, count] of newTestCounts) {
		mergedTestCounts.set(file, (mergedTestCounts.get(file) ?? 0) + count);
	}

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
			? Math.round((mergedFlakyCommits / mergedTotalCommits) * 1000) / 10
			: 0;

	// 8. Fetch test-related PRs (always re-fetch, cheap). The listing only
	// covers the 500 most recently updated PRs, so keep earlier-found ones.
	const fetchedPrs = await fetchTestFixPrs();
	const fetchedNumbers = new Set(fetchedPrs.map((pr) => pr.number));
	const fixPrsPath = path.join(OUTPUT_DIR, "fix-prs.json");
	const previousPrs: Array<FixPr> = fs.existsSync(fixPrsPath)
		? (JSON.parse(fs.readFileSync(fixPrsPath, "utf-8")).prs ?? [])
		: [];
	// Refresh still-open ones: they may have been merged or closed since. A
	// failed lookup keeps the previous state rather than aborting the run.
	const keptPrs = previousPrs
		.filter((pr) => !fetchedNumbers.has(pr.number))
		.map((pr) => {
			if (pr.merged_at) return { ...pr, state: "merged" as const };
			if (pr.state === "closed") return pr;
			try {
				const current = gh(`pulls/${pr.number}`) as {
					state: string;
					merged_at: string | null;
				};
				return {
					...pr,
					merged_at: current.merged_at,
					state: prState(current),
				};
			} catch {
				console.warn(`    Warning: could not refresh PR #${pr.number}`);
				return { ...pr, state: pr.state ?? "open" };
			}
		});
	const fixPrs = [...fetchedPrs, ...keptPrs];
	console.log(`Found ${fixPrs.length} test-related PRs`);

	// 9. Build flaky tests list. A test counts as fixed once a covering PR merged
	// and no later failure ran on a commit containing it (branches cut before
	// the fix still fail); an open covering PR means in review.
	const baseCounts = new Map<string, number>();
	for (const file of mergedTestCounts.keys()) {
		const base = path.basename(file);
		baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
	}
	const flakyTests: Array<FlakyTest> = Array.from(
		mergedTestCounts.entries(),
	).map(([file, count]) => {
		const failures = mergedRuns.filter((run) =>
			run.failed_tests.some((t) => t.file === file),
		);
		const last = failures.reduce(
			(max, run) => (run.created_at > max ? run.created_at : max),
			"",
		);
		// A bare basename from a PR body only counts when no other flaky test shares it
		const covering = fixPrs.filter((pr) =>
			pr.tests_fixed.some(
				(f) =>
					f === file ||
					(file.endsWith(`/${f}`) &&
						(f.includes("/") || baseCounts.get(f) === 1)),
			),
		);
		const fix = covering
			.filter((pr) => pr.merged_at)
			.sort((a, b) => (a.merged_at ?? "").localeCompare(b.merged_at ?? ""))
			.find((pr) =>
				failures.every(
					(run) =>
						run.created_at <= (pr.merged_at ?? "") ||
						!commitIncludesPr(run.sha, pr.number),
				),
			);
		const review = covering.find((pr) => pr.state === "open");
		const pr = fix ?? review;
		return {
			file,
			failure_count: count,
			last_failure: last,
			status: fix
				? "fixed"
				: !existsOnMain(file)
					? "removed"
					: review
						? "in_review"
						: "open",
			fix_pr: pr ? { number: pr.number, url: pr.url } : null,
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
	};

	const fixPrsData = {
		generated_at: now,
		prs: fixPrs,
	};

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	fs.writeFileSync(
		path.join(OUTPUT_DIR, "ci-runs.json"),
		JSON.stringify(ciRunsData, null, 2) + "\n",
	);
	fs.writeFileSync(
		path.join(OUTPUT_DIR, "flaky-tests.json"),
		JSON.stringify(flakyTestsData, null, 2) + "\n",
	);
	fs.writeFileSync(fixPrsPath, JSON.stringify(fixPrsData, null, 2) + "\n");

	const report = generateReport({
		period,
		summary: {
			total_commits: mergedTotalCommits,
			flaky_commits: mergedFlakyCommits,
			flakiness_rate: mergedFlakinessRate,
		},
		weeklyTrend: mergedWeeklyTrend,
		tests: flakyTests,
		prs: fixPrs,
	});
	fs.writeFileSync(path.join(OUTPUT_DIR, "REPORT.md"), report);
	fs.writeFileSync(
		path.join(OUTPUT_DIR, TREND_SVG),
		renderTrendSvg(mergedWeeklyTrend),
	);

	console.log("\nDone! Files written:");
	console.log(`  ${path.join(OUTPUT_DIR, "ci-runs.json")}`);
	console.log(`  ${path.join(OUTPUT_DIR, "flaky-tests.json")}`);
	console.log(`  ${fixPrsPath}`);
	console.log(`  ${path.join(OUTPUT_DIR, "REPORT.md")}`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});

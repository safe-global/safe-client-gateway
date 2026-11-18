// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Computes a pull request's risk tier from the files it changes, using the
 * `tier-map` block in docs/agents/risk-tiers.md, and checks it against the
 * tier the PR description states.
 *
 * Run by .github/workflows/risk-tier.yml as plain Node (type stripping), so it
 * imports nothing but Node built-ins: the workflow runs it without installing
 * the repository's dependencies.
 *
 * Usage: node scripts/risk-tier.ts --map <risk-tiers.md> --files <files.ndjson>
 *   --files  one JSON object per line, shaped like the GitHub "list pull request
 *            files" API entries: { filename, previous_filename?, additions, deletions }
 *   PR_BODY  (env) the pull request description
 *   GITHUB_OUTPUT / GITHUB_STEP_SUMMARY (env, optional) written when set
 */
import * as fs from 'node:fs';

export type Tier = 1 | 2 | 3 | 4;

export type TierMap = Record<Tier, Array<string>>;

export type ChangedFile = {
  filename: string;
  previousFilename: string | null;
  changes: number;
};

export type TierAssessment = {
  pathTier: Tier;
  computedTier: Tier;
  sizeEscalated: boolean;
  countedLines: number;
  filesByTier: Record<Tier, Array<string>>;
};

export type TierVerdict = {
  effectiveTier: Tier;
  statedTier: Tier | null;
  failures: Array<string>;
};

export const TIERS: ReadonlyArray<Tier> = [1, 2, 3, 4];
export const DEFAULT_TIER: Tier = 2;
export const SIZE_ESCALATION_LINES = 400;

const MAP_START = '<!-- tier-map:start -->';
const MAP_END = '<!-- tier-map:end -->';
const TIER_KEY_REGEX = /^tier([1-4]):\s*$/;
const PATTERN_LINE_REGEX = /^\s+-\s+"?([^"#]+?)"?\s*(?:#.*)?$/;
const STATED_TIER_REGEX = /\*\*Risk tier:\*\*\s*(?:tier\s*)?([1-4])\b/i;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const SIZE_EXEMPT_REGEX =
  /(?:\.spec\.ts|\.e2e-spec\.ts)$|(?:^|\/)__tests__\/|^test\/|(?:^|\/)yarn\.lock$/;

const ALLOWS: Record<Tier, string> = {
  1: 'two human maintainer approvals required',
  2: 'one human maintainer approval required',
  3: 'agent may approve; a human merges',
  4: 'agent may approve and merge',
};

function toTier(value: number): Tier {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  throw new Error(`${value} is not a risk tier`);
}

function emptyByTier(): Record<Tier, Array<string>> {
  return { 1: [], 2: [], 3: [], 4: [] };
}

/**
 * Converts a tier-map glob to an anchored regular expression. Supports `**`
 * (any depth, including none), `*` (within one path segment) and `?`.
 */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      const followedBySlash = glob[i + 2] === '/';
      source += followedBySlash ? '(?:.*/)?' : '.*';
      i += followedBySlash ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

/** Reads the `tier-map` block out of the risk-tiers guide. */
export function parseTierMap(markdown: string): TierMap {
  const start = markdown.indexOf(MAP_START);
  const end = markdown.indexOf(MAP_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No ${MAP_START} … ${MAP_END} block found`);
  }
  const map = emptyByTier();
  let current: Tier | null = null;
  for (const line of markdown.slice(start, end).split('\n')) {
    const tierKey = line.match(TIER_KEY_REGEX);
    if (tierKey) {
      current = toTier(Number(tierKey[1]));
      continue;
    }
    const pattern = line.match(PATTERN_LINE_REGEX);
    if (pattern && current !== null) {
      map[current].push(pattern[1]);
    }
  }
  if (TIERS.some((tier) => map[tier].length === 0)) {
    throw new Error('The tier-map block must list patterns for all four tiers');
  }
  return map;
}

/** The most critical tier whose patterns match `filePath`, or null. */
export function matchTier(map: TierMap, filePath: string): Tier | null {
  for (const tier of TIERS) {
    if (map[tier].some((glob) => globToRegExp(glob).test(filePath))) {
      return tier;
    }
  }
  return null;
}

/** A path matched by no pattern is Tier 2 (risk-tiers.md, rule 2). */
export function tierOfPath(map: TierMap, filePath: string): Tier {
  return matchTier(map, filePath) ?? DEFAULT_TIER;
}

/**
 * Rules 1, 2 and the size row of rule 3: the most critical tier of any path
 * touched (a rename counts both its old and new path), raised one tier when a
 * Tier 3 or 4 change exceeds the size threshold. Content-based escalations
 * (guards, secrets, migrations, …) are left to the reviewer.
 */
export function assessTier(
  map: TierMap,
  files: ReadonlyArray<ChangedFile>,
): TierAssessment {
  const filesByTier = emptyByTier();
  let pathTier: Tier = 4;
  let countedLines = 0;
  for (const file of files) {
    const paths = [file.filename, file.previousFilename].filter(
      (filePath): filePath is string => filePath !== null,
    );
    for (const filePath of paths) {
      const tier = tierOfPath(map, filePath);
      filesByTier[tier].push(filePath);
      pathTier = toTier(Math.min(pathTier, tier));
    }
    if (!SIZE_EXEMPT_REGEX.test(file.filename)) {
      countedLines += file.changes;
    }
  }
  const sizeEscalated = pathTier >= 3 && countedLines > SIZE_ESCALATION_LINES;
  const computedTier = sizeEscalated ? toTier(pathTier - 1) : pathTier;
  return { pathTier, computedTier, sizeEscalated, countedLines, filesByTier };
}

/** The tier stated on the description's `**Risk tier:** <n>` line, if any. */
export function parseStatedTier(body: string): Tier | null {
  const match = body.replace(HTML_COMMENT_REGEX, '').match(STATED_TIER_REGEX);
  return match ? toTier(Number(match[1])) : null;
}

/**
 * Rule 4: the computed tier is a floor. A stated tier may be more critical
 * (it then applies), never less.
 */
export function judge(
  computedTier: Tier,
  statedTier: Tier | null,
): TierVerdict {
  const failures: Array<string> = [];
  if (statedTier === null) {
    failures.push(
      `The PR description has no \`**Risk tier:** <n>\` line. Add \`**Risk tier:** ${computedTier} — <the path or rule that set it>\` as the first line of \`## Summary\`.`,
    );
  } else if (statedTier > computedTier) {
    failures.push(
      `The PR description states Tier ${statedTier}, but the changed paths make this at least Tier ${computedTier}. Change the line to \`**Risk tier:** ${computedTier}\`.`,
    );
  }
  const effectiveTier = toTier(
    Math.min(computedTier, statedTier ?? computedTier),
  );
  return { effectiveTier, statedTier, failures };
}

export function parseChangedFiles(ndjson: string): Array<ChangedFile> {
  return ndjson
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line): ChangedFile => {
      const entry: unknown = JSON.parse(line);
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('filename' in entry) ||
        typeof entry.filename !== 'string'
      ) {
        throw new Error(`Malformed changed-file entry: ${line}`);
      }
      const previous =
        'previous_filename' in entry &&
        typeof entry.previous_filename === 'string'
          ? entry.previous_filename
          : null;
      const additions =
        'additions' in entry && typeof entry.additions === 'number'
          ? entry.additions
          : 0;
      const deletions =
        'deletions' in entry && typeof entry.deletions === 'number'
          ? entry.deletions
          : 0;
      return {
        filename: entry.filename,
        previousFilename: previous,
        changes: additions + deletions,
      };
    });
}

export function renderSummary(
  assessment: TierAssessment,
  verdict: TierVerdict,
): string {
  const lines = [
    '## Risk tier',
    '',
    `**Risk tier:** ${verdict.effectiveTier} — ${ALLOWS[verdict.effectiveTier]}.`,
    '',
    `- Computed from changed paths: Tier ${assessment.pathTier}` +
      (assessment.sizeEscalated
        ? `, raised to Tier ${assessment.computedTier} for size (${assessment.countedLines} changed lines excluding tests and yarn.lock, over ${SIZE_ESCALATION_LINES}).`
        : '.'),
    `- Stated in the PR description: ${verdict.statedTier === null ? 'none' : `Tier ${verdict.statedTier}`}.`,
    '- Content-based escalations (guards, signatures, secrets, migrations, new dependencies, …) are not computed here; the reviewer applies them per docs/agents/risk-tiers.md.',
    '',
  ];
  if (verdict.failures.length > 0) {
    lines.push(
      '### Failures',
      '',
      ...verdict.failures.map((f) => `- ${f}`),
      '',
    );
  }
  for (const tier of TIERS) {
    const files = assessment.filesByTier[tier];
    if (files.length > 0) {
      lines.push(
        `<details><summary>Tier ${tier} paths (${files.length})</summary>`,
        '',
        ...files.map((f) => `- \`${f}\``),
        '',
        '</details>',
        '',
      );
    }
  }
  return lines.join('\n');
}

function argValue(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (value === undefined) {
    throw new Error(`Missing required argument ${flag}`);
  }
  return value;
}

function main(): void {
  const map = parseTierMap(fs.readFileSync(argValue('--map'), 'utf8'));
  const files = parseChangedFiles(fs.readFileSync(argValue('--files'), 'utf8'));
  const assessment = assessTier(map, files);
  const verdict = judge(
    assessment.computedTier,
    parseStatedTier(process.env.PR_BODY ?? ''),
  );
  const summary = renderSummary(assessment, verdict);

  process.stdout.write(`${summary}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `tier=${verdict.effectiveTier}\n`,
    );
  }
  if (verdict.failures.length > 0) {
    for (const failure of verdict.failures) {
      process.stdout.write(`::error title=Risk tier::${failure}\n`);
    }
    process.exitCode = 1;
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}

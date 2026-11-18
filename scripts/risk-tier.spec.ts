// SPDX-License-Identifier: FSL-1.1-MIT
import * as fs from 'node:fs';
import * as path from 'node:path';
import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '#/__tests__/builder';
import {
  assessTier,
  type ChangedFile,
  DEFAULT_TIER,
  globToRegExp,
  humanApprovers,
  judge,
  judgeApprovals,
  matchTier,
  parseChangedFiles,
  parseReviews,
  parseStatedTier,
  parseTierMap,
  parseUserIds,
  REQUIRED_HUMAN_APPROVALS,
  type Review,
  renderSummary,
  SIZE_ESCALATION_LINES,
  type TierMap,
  tierOfPath,
} from './risk-tier';

const REPO_ROOT = path.resolve(__dirname, '..');
const GUIDE_PATH = path.join(REPO_ROOT, 'docs/agents/risk-tiers.md');
const WALK_SKIP = new Set(['node_modules', 'dist', '.git', 'coverage']);

function changedFileBuilder(): IBuilder<ChangedFile> {
  return new Builder<ChangedFile>()
    .with('filename', faker.system.filePath().slice(1))
    .with('previousFilename', null)
    .with('changes', faker.number.int({ min: 1, max: 50 }));
}

function reviewBuilder(): IBuilder<Review> {
  return new Builder<Review>()
    .with('login', faker.internet.username())
    .with('isBot', false)
    .with('id', String(faker.number.int({ min: 1 })))
    .with('state', 'APPROVED');
}

function moduleName(): string {
  return faker.lorem.slug(2);
}

function tierMapOf(map: TierMap): string {
  const body = ([1, 2, 3, 4] as const)
    .flatMap((tier) => [`tier${tier}:`, ...map[tier].map((p) => `  - ${p}`)])
    .join('\n');
  return `# Guide\n\n<!-- tier-map:start -->\n\`\`\`yaml\n${body}\n\`\`\`\n<!-- tier-map:end -->\n`;
}

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (WALK_SKIP.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

describe('risk-tier', () => {
  describe('globToRegExp', () => {
    it('matches any depth, including none, for `**/`', () => {
      const name = moduleName();
      const regex = globToRegExp('src/**/guards/**');

      expect(regex.test(`src/guards/${name}.ts`)).toBe(true);
      expect(regex.test(`src/modules/${name}/routes/guards/a.ts`)).toBe(true);
      expect(regex.test(`src/modules/${name}/routes/a.ts`)).toBe(false);
    });

    it('keeps `*` within one path segment', () => {
      const regex = globToRegExp('src/app.*');

      expect(regex.test('src/app.module.ts')).toBe(true);
      expect(regex.test('src/app/module.ts')).toBe(false);
    });

    it('treats regex metacharacters in the glob literally', () => {
      const regex = globToRegExp('tsconfig*.json');

      expect(regex.test('tsconfig.build.json')).toBe(true);
      expect(regex.test('tsconfigXjson')).toBe(false);
    });
  });

  describe('parseTierMap', () => {
    it('reads the patterns of each tier, unquoting and dropping comments', () => {
      const [a, b, c, d] = Array.from({ length: 4 }, () => moduleName());
      const markdown = tierMapOf({
        1: [`src/modules/${a}/**`, '# a comment line'],
        2: [`"**/${b}.md"`],
        3: [`src/modules/${c}/**  # trailing comment`],
        4: [`docs/${d}/**`],
      });

      expect(parseTierMap(markdown)).toEqual({
        1: [`src/modules/${a}/**`],
        2: [`**/${b}.md`],
        3: [`src/modules/${c}/**`],
        4: [`docs/${d}/**`],
      });
    });

    it('throws when the block is missing', () => {
      expect(() => parseTierMap(faker.lorem.paragraphs())).toThrow(
        'No <!-- tier-map:start -->',
      );
    });

    it('throws when a tier has no patterns', () => {
      const markdown = tierMapOf({
        1: [`src/modules/${moduleName()}/**`],
        2: [],
        3: [`src/modules/${moduleName()}/**`],
        4: [`docs/${moduleName()}/**`],
      });

      expect(() => parseTierMap(markdown)).toThrow('all four tiers');
    });
  });

  describe('tier assessment', () => {
    const critical = moduleName();
    const high = moduleName();
    const low = moduleName();
    const map: TierMap = {
      1: [`src/modules/${critical}/**`, 'src/**/guards/**'],
      2: [`src/modules/${high}/**`],
      3: [`src/modules/${low}/**`],
      4: ['docs/**'],
    };

    it('resolves an overlapping path to its most critical match', () => {
      expect(tierOfPath(map, `src/modules/${low}/routes/guards/a.ts`)).toBe(1);
    });

    it('defaults an unmatched path to Tier 2', () => {
      const unmatched = `${moduleName()}/${moduleName()}.ts`;

      expect(matchTier(map, unmatched)).toBeNull();
      expect(tierOfPath(map, unmatched)).toBe(DEFAULT_TIER);
    });

    it('takes the most critical tier of any file touched', () => {
      const files = [
        changedFileBuilder().with('filename', 'docs/readme.md').build(),
        changedFileBuilder()
          .with('filename', `src/modules/${critical}/a.ts`)
          .build(),
      ];

      const assessment = assessTier(map, files);

      expect(assessment.computedTier).toBe(1);
      expect(assessment.filesByTier[4]).toEqual(['docs/readme.md']);
      expect(assessment.filesByTier[1]).toEqual([
        `src/modules/${critical}/a.ts`,
      ]);
    });

    it('counts the old path of a renamed file', () => {
      const file = changedFileBuilder()
        .with('filename', `src/modules/${low}/moved.ts`)
        .with('previousFilename', `src/modules/${critical}/moved.ts`)
        .build();

      expect(assessTier(map, [file]).computedTier).toBe(1);
    });

    it('raises a large Tier 3 or 4 change by one tier', () => {
      const file = changedFileBuilder()
        .with('filename', `src/modules/${low}/a.ts`)
        .with('changes', SIZE_ESCALATION_LINES + 1)
        .build();

      const assessment = assessTier(map, [file]);

      expect(assessment.pathTier).toBe(3);
      expect(assessment.sizeEscalated).toBe(true);
      expect(assessment.computedTier).toBe(2);
    });

    it('leaves a change at exactly the size threshold alone', () => {
      const file = changedFileBuilder()
        .with('filename', `src/modules/${low}/a.ts`)
        .with('changes', SIZE_ESCALATION_LINES)
        .build();

      expect(assessTier(map, [file]).computedTier).toBe(3);
    });

    it('excludes tests and yarn.lock from the size count', () => {
      const files = [
        `src/modules/${low}/a.spec.ts`,
        `src/modules/${low}/__tests__/a.builder.ts`,
        'test/e2e-setup.ts',
        'yarn.lock',
      ].map((filename) =>
        changedFileBuilder()
          .with('filename', filename)
          .with('changes', SIZE_ESCALATION_LINES + 1)
          .build(),
      );

      expect(assessTier(map, files).countedLines).toBe(0);
    });

    it('does not size-escalate Tier 1 or Tier 2 changes', () => {
      const file = changedFileBuilder()
        .with('filename', `src/modules/${high}/a.ts`)
        .with('changes', SIZE_ESCALATION_LINES * 10)
        .build();

      expect(assessTier(map, [file]).computedTier).toBe(2);
    });
  });

  describe('parseStatedTier', () => {
    it('reads the tier from the Risk tier line', () => {
      const body = `## Summary\n\n**Risk tier:** 2 — ${faker.lorem.sentence()}\n`;

      expect(parseStatedTier(body)).toBe(2);
    });

    it('accepts a "Tier" prefix', () => {
      expect(parseStatedTier('**Risk tier:** Tier 3 — docs')).toBe(3);
    });

    it('ignores the unfilled template placeholder', () => {
      const body = '**Risk tier:** <!-- 1–4 and the path or rule -->';

      expect(parseStatedTier(body)).toBeNull();
    });

    it('returns null when no tier is stated', () => {
      expect(parseStatedTier(faker.lorem.paragraphs())).toBeNull();
    });
  });

  describe('judge', () => {
    it('fails when no tier is stated', () => {
      const verdict = judge(2, null);

      expect(verdict.effectiveTier).toBe(2);
      expect(verdict.failures).toHaveLength(1);
      expect(verdict.failures[0]).toContain('**Risk tier:** 2');
    });

    it('fails when the stated tier is less critical than computed', () => {
      const verdict = judge(1, 3);

      expect(verdict.effectiveTier).toBe(1);
      expect(verdict.failures[0]).toContain('at least Tier 1');
    });

    it('accepts a matching tier', () => {
      expect(judge(3, 3)).toEqual({
        effectiveTier: 3,
        statedTier: 3,
        failures: [],
      });
    });

    it('applies a stated tier that is more critical than computed', () => {
      expect(judge(4, 2)).toEqual({
        effectiveTier: 2,
        statedTier: 2,
        failures: [],
      });
    });
  });

  describe('parseChangedFiles', () => {
    it('reads GitHub pull-request-file entries, one per line', () => {
      const filename = faker.system.filePath().slice(1);
      const previous = faker.system.filePath().slice(1);
      const additions = faker.number.int({ max: 100 });
      const deletions = faker.number.int({ max: 100 });
      const ndjson = [
        JSON.stringify({ filename, additions, deletions }),
        '',
        JSON.stringify({
          filename,
          previous_filename: previous,
          additions,
          deletions,
        }),
      ].join('\n');

      expect(parseChangedFiles(ndjson)).toEqual([
        { filename, previousFilename: null, changes: additions + deletions },
        {
          filename,
          previousFilename: previous,
          changes: additions + deletions,
        },
      ]);
    });

    it('throws on an entry without a filename', () => {
      expect(() =>
        parseChangedFiles(JSON.stringify({ additions: 1, deletions: 1 })),
      ).toThrow('Malformed changed-file entry');
    });
  });

  describe('renderSummary', () => {
    it('leads with the tier and what it allows, then lists failures', () => {
      const map: TierMap = {
        1: ['a/**'],
        2: ['b/**'],
        3: ['c/**'],
        4: ['d/**'],
      };
      const assessment = assessTier(map, [
        changedFileBuilder().with('filename', 'a/x.ts').build(),
      ]);

      const approver = faker.internet.username();

      const summary = renderSummary(
        assessment,
        judge(1, null),
        judgeApprovals(1, [approver]),
      );

      expect(summary).toContain(
        '**Risk tier:** 1 — two human maintainer approvals required.',
      );
      expect(summary).toContain('### Failures');
      expect(summary).toContain('- `a/x.ts`');
      expect(summary).toContain(
        `Human approvals: 1 of 2 required (${approver})`,
      );
    });
  });

  it('classifies filenames with line breaks and renders them on one Markdown line', () => {
    const filename = 'private/name\nwith`format<chars>.ts';
    const assessment = assessTier({ 1: ['private/**'], 2: [], 3: [], 4: [] }, [
      changedFileBuilder().with('filename', filename).build(),
    ]);
    expect(assessment.computedTier).toBe(1);
    const summary = renderSummary(
      assessment,
      judge(1, 1),
      judgeApprovals(1, []),
    );
    expect(summary).toContain('- `private/name%0Awith%60format%3Cchars%3E.ts`');
  });

  describe('review evidence', () => {
    it('requires an ID and a human account type', () => {
      const review = reviewBuilder().build();
      const input = { ...review, type: 'User' };
      expect(parseReviews(JSON.stringify(input))).toEqual([review]);
      for (const type of ['Bot', undefined]) {
        expect(parseReviews(JSON.stringify({ ...input, type }))[0].isBot).toBe(
          true,
        );
      }
      expect(
        parseReviews(
          JSON.stringify({ ...input, login: `${review.login}[bot]` }),
        )[0].isBot,
      ).toBe(true);
      expect(() =>
        parseReviews(JSON.stringify({ ...input, id: undefined })),
      ).toThrow('Malformed review');
    });

    it('parses only numeric account IDs', () => {
      expect(parseUserIds('12\n  34\n')).toEqual(['12', '34']);
      expect(parseUserIds('')).toEqual([]);
      expect(() => parseUserIds('12 someone')).toThrow(
        'numeric GitHub user IDs',
      );
    });

    it('counts only the current approval of an eligible maintainer', () => {
      const reviewer = reviewBuilder().build();
      const other = reviewBuilder().build();
      const members = [reviewer.id];
      expect(humanApprovers([reviewer, other], [], members)).toEqual([
        reviewer.login,
      ]);
      expect(humanApprovers([reviewer], [], [])).toEqual([]);
      expect(humanApprovers([reviewer], [reviewer.id], members)).toEqual([]);
      expect(
        humanApprovers([{ ...reviewer, isBot: true }], [], members),
      ).toEqual([]);
      const renamed = { ...reviewer, login: faker.internet.username() };
      expect(
        humanApprovers(
          [reviewer, renamed, { ...renamed, state: 'COMMENTED' }],
          [],
          members,
        ),
      ).toEqual([renamed.login]);
      for (const state of ['DISMISSED', 'CHANGES_REQUESTED']) {
        expect(
          humanApprovers([reviewer, { ...renamed, state }], [], members),
        ).toEqual([]);
      }
    });
  });

  describe('judgeApprovals', () => {
    it.each([1, 2, 3, 4] as const)(
      'requires the tier table count of human approvals for Tier %i',
      (tier) => {
        const required = REQUIRED_HUMAN_APPROVALS[tier];
        const enough = Array.from({ length: required }, () =>
          faker.internet.username(),
        );

        expect(judgeApprovals(tier, enough).satisfied).toBe(true);
        if (required > 0) {
          expect(judgeApprovals(tier, enough.slice(1)).satisfied).toBe(false);
        }
      },
    );

    it('requires two human approvals at Tier 1 and one at Tier 2', () => {
      expect(REQUIRED_HUMAN_APPROVALS).toEqual({ 1: 2, 2: 1, 3: 0, 4: 0 });
    });
  });

  describe('docs/agents/risk-tiers.md', () => {
    const map = parseTierMap(fs.readFileSync(GUIDE_PATH, 'utf8'));
    const repoFiles = walk(REPO_ROOT);

    it('classifies every module explicitly, so none falls to the default', () => {
      const modules = fs
        .readdirSync(path.join(REPO_ROOT, 'src/modules'), {
          withFileTypes: true,
        })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      const unclassified = modules.filter(
        (name) =>
          matchTier(map, `src/modules/${name}/${name}.module.ts`) === null,
      );

      expect(unclassified).toEqual([]);
    });

    it('has no pattern that matches nothing in the repository', () => {
      const stale = ([1, 2, 3, 4] as const)
        .flatMap((tier) => map[tier])
        .filter((glob) => {
          const regex = globToRegExp(glob);
          return !repoFiles.some((file) => regex.test(file));
        });

      expect(stale).toEqual([]);
    });

    it('keeps the guide, this check and its workflow at Tier 1', () => {
      expect(tierOfPath(map, 'docs/agents/risk-tiers.md')).toBe(1);
      expect(tierOfPath(map, 'scripts/risk-tier.ts')).toBe(1);
      expect(tierOfPath(map, 'scripts/risk-tier-inputs.sh')).toBe(1);
      expect(tierOfPath(map, 'scripts/generate-abis.js')).toBe(1);
      expect(tierOfPath(map, 'scripts/generate-token.ts')).toBe(1);
      expect(
        tierOfPath(map, 'src/modules/surveys/domain/surveys.repository.ts'),
      ).toBe(2);
      expect(tierOfPath(map, 'scripts/risk-tier.spec.ts')).toBe(1);
      expect(tierOfPath(map, '.github/workflows/risk-tier.yml')).toBe(1);
      expect(tierOfPath(map, '.github/workflows/risk-tier-required.yml')).toBe(
        1,
      );
      expect(tierOfPath(map, '.github/rulesets/risk-tier.json')).toBe(1);
    });
  });
});

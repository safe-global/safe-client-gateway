<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Agent Tooling

The guides in this directory are the content. This file documents the three mechanisms that put them in front of an agent at the right moment — the skills in `.claude/skills/`, which load themselves, the review hook in `.claude/settings.json`, which runs itself, and the `Claude Review` CI workflow, which reviews a pull request on demand and when it becomes ready for review — plus the conventions for adding to any of them.

The first two are **automatic by design**. Nothing here needs a slash command typed to take effect, which is why the repo ships none of its own (see "Commands" below).

Everything follows the one-content-home rule: `docs/agents/` holds the content, and everything under `.claude/` is a thin loader that links back to it. A loader that starts restating a guide's rules has created a second copy that will drift, and only the guide gets reviewed.

## Skills

One skill per guide, each a loader. Skills exist because a routing table only works if someone reads it: a skill's `description` is what makes Claude Code load the right guide when the work starts, without being asked for it.

| Skill | Loads | Triggers on |
|---|---|---|
| `cgw-architecture` | [ARCHITECTURE.md](ARCHITECTURE.md) | Any non-trivial change; "where does this go", "how does a request flow" |
| `cgw-best-practices` | [best-practices.md](best-practices.md) | Any TypeScript edit; casts, `any`, catch blocks, logging |
| `cgw-module-structure` | [module-structure.md](module-structure.md) | New module, moving/renaming files, naming, controller versioning, Symbol DI |
| `cgw-nestjs-patterns` | [nestjs-patterns.md](nestjs-patterns.md) | Providers, guards, interceptors, pipes, filters, DI, circular deps |
| `cgw-api-dtos` | [api-dtos-and-validation.md](api-dtos-and-validation.md) | New endpoint, DTO, Zod schema, Swagger, pagination |
| `cgw-security` | [security.md](security.md) | Auth, guards, tokens, signatures, secrets, PII, rate limits |
| `cgw-performance` | [caching-and-performance.md](caching-and-performance.md) | Cache, TTL, invalidation, upstream call, N+1, batching, queue jobs |
| `cgw-database` | [database-and-migrations.md](database-and-migrations.md) | Migrations, `*.entity.db.ts`, indexes, SQL |
| `cgw-config` | [configuration-and-flags.md](configuration-and-flags.md) | Env vars, feature flags, config keys |
| `cgw-testing` | [testing.md](testing.md) | Any test file; builders, mocks, the Fastify test harness |
| `cgw-review` | [reviewing.md](reviewing.md) | Reviewing a diff; self-check before commit or PR |
| `cgw-remarks` | [remarks.md](remarks.md) | Reviewing a diff; "what will reviewers flag" |
| `cgw-commits-and-prs` | [commits-and-prs.md](commits-and-prs.md) | Commit messages, PR titles and bodies, splitting a PR |

### Conventions for adding a skill

1. **One skill per guide, `cgw-` prefixed.** The prefix keeps these distinguishable from plugin and built-in skills — `review`, `testing`, and `security-review` all already exist as other things — and makes the repo-specific ones obvious in a skill listing. The `name` in the frontmatter always equals the directory name.
2. **The skill is the trigger; the doc is the content.** A skill body links its guide, states the two or three rules that break things immediately if missed, and stops.
3. **The `description` is the whole interface.** It is what Claude Code matches against to decide whether to load the skill, so it names the *situations* and the *vocabulary* a developer would actually use, not an abstract topic. Third person ("Use when …"), concrete triggers, specific enough not to fire on unrelated work.
4. **Cross-link sibling skills by name** where a task genuinely needs two. Guides link guides; skills link skills.
5. **No SPDX header in a `SKILL.md`.** YAML frontmatter must be the first line for Claude Code to parse it, so `.claude/` is excluded from the `insert-license` markdown hook in `.pre-commit-config.yaml`.
6. **Nothing but `<name>/SKILL.md` lives under `.claude/skills/`.** A loose markdown file there is picked up as a skill in its own right — which is why this document is here rather than in a `README.md` beside them.

## The review hook

`.claude/settings.json` carries one `PreToolUse` hook, filtered to `git commit` via `if: "Bash(git commit *)"`. When `src/` has changes — staged or unstaged, so `git commit -a` is covered too — it injects an instruction to read `reviewing.md` and apply both parts of its checklist before the commit is treated as done. The hook deliberately points at the file rather than inlining the checklist items: an inlined copy drifts every time `reviewing.md` is edited (it did — see the stale-guides item that copy was missing). When `src/` is untouched it emits nothing and exits 0, so a docs-only commit is unaffected.

**Why a hook rather than a slash command.** The review is the one part of the pre-PR flow that nothing else triggers: `.husky/pre-commit` already runs `yarn env:validate:silent`, `yarn lint` and `yarn format` on every commit, so the mechanical half is automatic, but the guideline and deviation checks depended on someone remembering to ask for them. A hook removes the remembering. This repo deliberately has **no repo-specific slash commands** for that reason — see the next section.

**What it is and is not.** It injects context; it does not gate. The commit still proceeds, so the hook cannot deadlock and cannot produce a false rejection. If you want a hard gate instead, the same hook can exit 2 (or return `decision: "block"`) to bounce the first attempt with the checklist as the reason — but then it needs a way to recognize that the review already happened, or every commit blocks forever.

**Two constraints on the command, learned the hard way:**

- **No `jq`.** It is a reasonable assumption elsewhere and is not installed in every environment used with this repo. The command uses only `git`, `test` and `printf`, and leans on the `if` field for filtering rather than parsing the hook's stdin JSON. Validate hook JSON with `node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))'` instead — Node is the one runtime this repo already guarantees.
- **Both paths need testing, not just the firing one.** Run the exact command string from `settings.json` twice — once with `src/` clean (expect empty stdout, exit 0) and once with a throwaway change under `src/` (expect valid JSON) — and revert the probe afterwards. A hook whose no-op path exits non-zero is noise on every unrelated commit.

A newly created `.claude/settings.json` may not be picked up until the settings watcher reloads: it only watches directories that already had a settings file when the session started. Opening `/hooks` once, or restarting, loads it.

## The CI gate

`.github/workflows/claude-review.yml` runs two ways: on demand, when a collaborator (`COLLABORATOR`/`MEMBER`/`OWNER` allowlist) comments **`@claude review`** on a PR (a top-level PR comment — inline review-thread comments do not trigger it), and automatically, when a same-repo PR becomes ready for review — opened as a non-draft, or a draft marked ready — and no Claude review comment exists on it yet — an explicit comment trigger always reviews, the automatic one never duplicates a review that already happened. The comment match is exact — the body must be `@claude review` and nothing else, so trailing words do not trigger it (and cannot smuggle text toward the agent, which never sees the comment body anyway) and a future sibling workflow can safely claim any other `@claude …` phrase. One `claude-code-action` step runs an orchestrator that dispatches **two independent subagent passes** — both on Claude Fable 5 at max effort (`--effort` is session-wide and subagents inherit it, verified against the CLI's captured API requests) — over the full base…head diff fetched via the GitHub API: a *guideline pass* applying [reviewing.md](reviewing.md) (Part 1 against every row of the AGENTS.md routing table, Part 2's deviation checks, plus any [remarks.md](remarks.md) R-NNN the diff earns) and a *quality pass* reviewing for bugs, security, performance, test coverage and code quality.

Neither pass sees the other's findings — they are separate contexts, so the checklist pass cannot anchor the open-ended one. The orchestrator only merges, posting **one PR comment** via `gh pr comment`: an `## Architecture check` section (the applicable guides as links, the findings as a numbered list in [reviewing.md](reviewing.md)'s reporting format — linked rule, permalinked location, a `Fix:` naming the concrete change — or "No findings.", and a verdict line ✅ compliant / ❌ N findings counting only guideline findings), then a `## Code review` section (numbered findings with a `Suggestion:` each, or "No findings."), then a footer naming what ran and linking back here. The agent writes no files and the workflow is advisory — the comment is the verdict, and the run itself stays green either way.

One Part 2 item is adapted for CI: "pre-commit commands ran clean" is skipped because the CI pipeline's lint/format/test jobs are the evidence. The spec-match item needs no adaptation — no approved spec/plan is committed here, so [reviewing.md](reviewing.md)'s own fallback applies and the diff is judged against the PR title and description.

The review agents read untrusted PR content, so the orchestrator's prompt and both subagent prompts carry an injection warning (the orchestrator additionally treats its subagents' returned findings as untrusted, since they quote PR content), and the tools are read-only plus `gh pr comment` for the single result comment. The runner never checks out the PR head: the checkout is the default branch, used only for the guides, and the PR's content arrives solely through `gh pr view`/`gh pr diff` — so untrusted code never reaches the runner's disk and a force-push mid-review cannot swap what gets analyzed (the CodeQL untrusted-checkout and TOCTOU alerts this design avoids). Each allowed `gh` command is pinned to the triggering PR's number, and the permission rules apply session-wide, so the pin gates the subagents' `gh` calls too. The `--body:*` pin is necessarily a prefix rule (the body text is arbitrary), which in principle admits flags appended after the body — but that residual escape is accepted rather than engineered around, because it leads nowhere: a smuggled second `--repo` (which `gh` resolves last-wins) fails auth, since the action's app token is scoped exclusively to this repository, and the PR number is positional and already supplied, so it cannot be overridden by anything appended. The alternatives — posting via `--body-file` (needs granting the agent a Write tool) or via a separate workflow step (needs raising the job token to `issues: write`) — both widen the surface more than the escape they close. Two maintenance couplings inside the workflow follow from this: the `--allowedTools` Bash pins must mirror the `gh` commands listed in the prompt verbatim (the match is exact-string, only `--body:*` is a prefix), so a flag added to a command in the prompt — say another `--json` field on `gh pr view` — silently blocks that command for the subagents unless the pin is updated in the same edit; and the subagent effort inheritance was verified at claude-code-action v1.0.193, so re-verify it when bumping the action pin. The orchestrator's strip-HTML/images/@-mentions rule for the posted comment is instruction-level by design — an accepted residual risk, because a deterministic post-edit would require `issues: write` (the job grants only `issues: read`; the comment is posted via the action's app token) and a mechanical HTML strip would mangle code spans that merely look like tags (`Raw<T>`), while the worst miss is formatting or a stray mention inside one advisory comment. The three prompts live as files in `.github/claude-review/` — `orchestrator.md`, `guideline-pass.md`, `quality-pass.md` — read at run time from the default-branch checkout, so prompt edits get normal reviewable file diffs; the flip side of that checkout choice is that a PR editing these files is itself reviewed with the default branch's versions, so a prompt change only takes effect — and can only be observed working — after it merges; the workflow itself only carries the PR values and the exact permitted `gh` commands, and a fourth sibling file, `agents.json`, holds the `--agents` stub pointing each subagent at its prompt file — loaded into a job-level env var via a `cat`-and-heredoc step (minified to one line first, since it lands inside a line-oriented block scalar) and checked by a `node -e` JSON-parse step before the review runs (`node`, not `jq` — same reasoning as the hook constraint above) — necessary because the CLI silently ignores a malformed `--agents` value rather than failing, which would degrade the review to zero passes with no error.

`--allowedTools` is session-wide, so the `gh pr comment ... --body:*` pin is reachable from either subagent, not just the orchestrator — both are given `Bash` in their `--agents` tool list, so nothing at the CLI layer stops a subagent from calling `gh pr comment` itself and bypassing the orchestrator's post-processing (the HTML/image/@-mention strip, the bare-`#N` rule, the dedup marker). This is accepted as a residual risk rather than engineered around: splitting subagents and orchestrator across separate `claude-code-action` invocations (so only the orchestrator's session carries the `gh pr comment` permission) would need a workflow-level restructure, and the failure mode it prevents — a subagent posting a differently-shaped or unstripped comment instead of the merged one — is a formatting defect on one advisory comment, not a security escalation (the pin is still scoped to this PR's number and repo). Re-examine this if a future pass is given a tool that makes a rogue post more consequential (e.g. write access beyond a single comment).

The verdict is still an LLM judgment: a finding it misses stays missed, so the gate complements, not replaces, the skills and the hook that run while the code is being written.

## Commands

**This repo intentionally ships no repo-specific slash commands.** Seven were written and then removed before merge, deliberately: `/new-route`, `/new-datasource`, `/new-domain-service`, `/new-env-var`, `/new-migration`, `/audit-test`, `/pr-ready`.

The reasoning, worth keeping so it is not re-litigated: a command only runs when someone types a slash, and each of those seven was a second copy of a sequence the skills already carry. Asking for an endpoint loads `cgw-api-dtos` and `cgw-security` on its own and gets the same steps, so the command file added a parallel copy to keep in sync and nothing else — dead weight by this repo's own YAGNI rule in [reviewing.md](reviewing.md). `/pr-ready` was the one with genuine independent value, because it *acted* rather than informed; that value now lives in the review hook above, which does not need to be invoked at all.

Adding one back is a reasonable thing to do — but the bar is that it must do something a skill cannot: perform an action, or run a sequence you would not think to ask for. If it would only tell an agent what it could have read from a guide, it belongs in the guide.

### Spec Kit commands

`speckit.*` — `specify`, `clarify`, `plan`, `tasks`, `implement`, `analyze`, `checklist`, `constitution`, `taskstoissues`. These are the only commands in `.claude/commands/`, and they are **kept as-is**. They come from [Spec Kit](https://github.com/github/spec-kit) and are process commands (idea → spec → tasks) — a different job from anything these guides cover, and one a skill cannot do. They are upstream files: do not hand-edit them, they are replaced wholesale when Spec Kit is updated. Their templates and scripts live in `.specify/`.

### If you do add one

1. **It must act, not inform.** Perform something, or run a sequence nobody would think to ask for. A command that only points at a guide is a guide with extra steps.
2. **Reference, never restate.** Name the skills and guides to load, then list only the steps specific to that workflow.
3. **Idempotent.** Inspect current state before writing; re-running it reports what is already correct rather than duplicating it.
4. **End in verification** — `yarn format`, `yarn lint --fix`, the relevant tests, with the **real output** reported. [reviewing.md](reviewing.md) treats an unproven "tests pass" as a finding.
5. **Frontmatter:** a one-line `description` (this is what shows in the command list) plus an `argument-hint` when it takes arguments; `$ARGUMENTS` in the body. No SPDX header, for the same frontmatter reason as skills.
6. **Name it for the workflow, not the tool** — `/new-env-var`, not `/config-helper`.
7. **Nothing but command files lives under `.claude/commands/`** — a loose markdown file there becomes a command, exactly as a loose one under `.claude/skills/` becomes a skill.

## Trigger validation

A skill's `description` is the only thing the auto-load decision sees, so it is the part that needs testing — and it is testable: give a fresh session a synthetic prompt phrased the way a developer would actually phrase it, and check which skill it reaches for. Doing this to the first draft of these thirteen found five real defects, each of which is worth knowing about when writing the next one:

- **Two skills sharing a trigger phrase is a coin flip, not a fallback.** `cgw-review` and `cgw-remarks` both opened with "use when reviewing a diff", so neither won. The fix was to state the relationship in the descriptions themselves — one is the entry point, the other is the catalog it consults.
- **A description must claim symptoms, not just concepts.** "Why is my provider constructed twice?" matched nothing in `cgw-nestjs-patterns`, whose triggers were all primitive names; the `useExisting`-vs-`useClass` rule that answers it was one keyword away from being unreachable.
- **Developers phrase permissions as features.** "Let a user delete their own address book entry" contains no security vocabulary at all, so `cgw-security` — the skill that owns exactly that change class — did not fire.
- **A shared trigger word pulls in the wrong owner.** `cgw-security` listing a bare "env var" made it fire on plain feature flags, which `cgw-config` owns; it now claims only the secret half explicitly.
- **The same change class routes on incidental wording.** "Add a column" and "add a field" are one change with four representations, and were reaching two different skills; each now names the other.

Re-testing after an edit needs a genuinely fresh session — a subagent spawned mid-session inherits the skill listing as it was at spawn time and will re-read the old descriptions.

## Relationship to process plugins

Skills and commands here carry **repo context**, never workflow. Process plugins (Superpowers, spec-kit) govern *how* work happens — brainstorming, TDD, debugging, verification order. These guides define *what correct looks like here*, and are the answer when a process skill asks for repo specifics: verification commands, test conventions, architectural context. A skill or command in this repo that starts dictating the order of work has overstepped.

The same contract is stated at the top of [AGENTS.md](../../AGENTS.md).

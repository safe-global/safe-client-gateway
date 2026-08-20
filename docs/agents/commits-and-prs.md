<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Commits and Pull Requests

This guide states the shape a commit, a PR title, and a PR body take in this repo. Nothing here is machine-enforced today — there is no `commit-msg` hook and no PR-title CI check (see "Enforcement status" at the end), so the convention holds only because every commit and PR is written to it deliberately.

`main` is squash-merged: every commit on `main` is one PR, and its subject is the **PR title** with `(#NNNN)` appended by GitHub. That single fact drives most of the rules below — the PR title is the permanent history entry, and the individual commit subjects on a branch are working notes that disappear on merge.

## Commit subject format

**Rule:** A commit subject is `<type>(<scope>)?: <description>` — a lowercase type from the table below, an optional lowercase scope in parentheses, then `: `, then an imperative, lowercase-initial description with no trailing period. The subject stays under 72 characters. A breaking change appends `!` after the type/scope (`feat(auth)!: …`) and explains the break in the body.

**Why:** the subject line is the only part of a commit most readers ever see — in `git log --oneline`, in release-note generation, and in blame output. A consistent `type(scope):` prefix makes 400 commits of history filterable by kind and by subsystem without reading any bodies; a subject that departs from it is invisible to every one of those tools.

**Canonical example:** `feat: implement billing endpoints in CGW (#3269)`, `chore(deps): upgrade typeorm to 1.1.0 (#3290)`, `refactor(zerion): improve ZerionChainMappingService with Symbol DI` — the dominant shape across the last several hundred commits on `main`. The subjects to recognize and not imitate, all on `main` today: `Title: build(deps): bump transitive dependencies (#3295)` (a literal `Title:` prefix pasted from a template), `feature: …` (not a valid type — it is `feat`), `Squashed commit of the following: (#3060)`, and bare descriptions with no type at all such as `updated me endpoint to return user session (#3020)` and `Update chainId handling from number to string in fee service (#3137)`.

```
# Don't — no type, past tense, capitalized
Updated the me endpoint to return the user session

# Do — type, imperative, lowercase, under 72 chars
feat(users): return the user session from the me endpoint
```

## Allowed types

**Rule:** The type is one of the nine below, chosen by what the change *is*, not by which files it touches.

| Type | Use it for | Not for |
|---|---|---|
| `feat` | A new capability visible to a client of this service — a new endpoint, a new field in a response, a new flag that changes behavior. | Internal restructuring with no client-visible effect (`refactor`). |
| `fix` | A behavior correction: wrong response, crash, incorrect cache invalidation, security defect. | A change that only prevents a *future* mistake (`refactor`, `test`, or `ci`). |
| `refactor` | Restructuring that provably does not change behavior — extraction, renaming, moving a file, tightening a type. | Anything that changes a response shape (that is `feat` or `fix`). |
| `perf` | A change whose *purpose* is a measured latency, throughput, or call-count improvement. | A cache added as part of a new feature (that is `feat`). |
| `test` | Adding or changing `*.spec.ts` / `*.integration.spec.ts` / e2e files only. | A production-code fix that happens to also add a regression test — that is `fix`. |
| `docs` | Markdown, `docs/agents/`, README, code comments only. | A change touching `src/`. |
| `build` | Dependency bumps and build tooling (`package.json`, `yarn.lock`, `Dockerfile`, `tsconfig`). Dependabot uses `build(deps)` / `build(deps-dev)`. | CI workflow files (`ci`). |
| `ci` | `.github/workflows/`, `.husky/`, `.pre-commit-config.yaml`. | Build configuration (`build`). |
| `chore` | Housekeeping that fits nothing above — deleting dead code, config key renames, repo maintenance. | Anything that fits a more specific type. `chore` is the last resort, not the default. |

**Why:** `main`'s history is ~40% `build(deps)` bumps; the type is what lets a human reading history skip them and find the eleven `feat` commits that actually changed the service. A `chore` used as a catch-all for a behavior change makes that filter lie.

**Canonical example:** `test(spaces): consolidate integration spec repo construction`, `perf: batch malicious-address scans to the provider limit`, `ci: pin claude-code-action to a commit hash`. The anti-example on `main` is `feature: …`, which no `type` filter matches.

## Scopes

**Rule:** The scope, when present, is the module directory name under `src/modules/` in kebab-case (`safe-shield`, `csv-export`, `counterfactual-safes`), or `deps`/`deps-dev` for dependency bumps. A change spanning three or more modules, or one to shared infrastructure, omits the scope rather than inventing a wide one. A scope is never capitalized, never space-separated, and never a comma-joined list.

**Why:** a scope's only job is to answer "which subsystem" in one token, so it has to be a token that already exists in the tree — a scope spelled three different ways is three different scopes to every tool that groups by it.

**Canonical example:** `safe-shield` (20 commits), `spaces` (8), `portfolio` (7), `auth` (5), `circuit-breaker` (4) — all real directory names. The variants to not imitate, all present on `main`: `Safe Shield` and `safe shield` (capitalized/spaced duplicates of `safe-shield`), `spaces,users` (a list), and `relay` alongside `relayer` for the same module.

```
# Don't — three spellings of one module, and a comma list
fix(Safe Shield): ...
fix(safe shield): ...
feat(spaces,users): ...

# Do — the directory name, or no scope when the change is wide
fix(safe-shield): ...
feat: propagate the space member alias through the users module
```

## PR title

**Rule:** The PR title is a valid commit subject per the rules above — same type, same scope, same imperative mood, same length budget — because squash-merge makes it the commit subject verbatim. GitHub's default titles (`Feat add subscriptions model`, `Update file.ts`) are always rewritten before merge.

**Why:** there is no CI check on PR titles and no `commit-msg` hook, so a malformed title is not caught anywhere — it merges, and `main`'s history carries it permanently. Every non-conforming subject on `main` today entered exactly this way.

**Canonical example:** three titles that merged clean as history entries:

```
feat: implement billing endpoints in CGW
fix(hooks): drop the deprecated failed field from the executed-transaction schema
build(deps): bump @fastify/cookie from 11.0.2 to 11.1.1
```

The anti-example is `Feat add subscriptions model` (open PR #3327): capitalized, no `:`, no type — it would land on `main` as a subject no type filter matches.

## PR body

**Rule:** The body is `.github/pull_request_template.md`'s two sections — nothing more. Every section carries content — an empty `## Summary` heading is worse than no heading.

| Section | Required | Content |
|---|---|---|
| `## Summary` | Always | What changed and why, in prose. The reader is a reviewer who has not seen the ticket. |
| `## Changes` | Always | Per-area bullets. For a wide change, group by directory or module, as PR #3328 does. |

**Why:** the body stays lean because everything else already has a home — pre-commit evidence is the PR's own CI run, and risk belongs in `## Summary`'s prose when it is worth a reviewer's attention. What does land here is every requirement another guide places on the description *text itself* (not a commit message or a chat thread), and all of them belong in `## Summary` — a justification for ratchet-baseline growth and the declaration of a multi-PR series naming the follow-up that consumes an artifact shipped ahead of its reader (`reviewing.md`), the link to the follow-up PR when `routes/` lands ahead of its controller (`module-structure.md`), the justification for changing a field in place that no released client could have parsed (`api-dtos-and-validation.md`), the before/after number for a performance change (`caching-and-performance.md`), and the justification for `OptionalAuthGuard` on a caller-scoped route (`security.md`). Each guide states its own; treat that set as open, since a guide may add one without editing this rule.

**Canonical example:** three bodies whose shape matched what they changed:

```markdown
## Summary
Add the billing endpoints so clients can read plans and open a checkout session.
Behind `FF_BILLING`, default off; unsetting `BILLING_WEBHOOK_JWT_PUBLIC_KEY` fails
startup validation rather than silently disabling webhook auth.

## Changes
- `src/modules/billing/routes/` — controller, DTOs, Zod schemas for the three endpoints
- `src/modules/billing/domain/` — repository + `Schema.parse()` at the boundary
- `src/modules/billing/datasources/` — the billing-service client via `CacheFirstDataSource`
```

```markdown
## Summary
`getRecipientAnalysisCacheDir` swallowed a `JSON.stringify` failure, so a
serialization error produced a silently-wrong cache key instead of a log line.
The fallback behavior is unchanged, only now observable.

## Changes
- `src/datasources/cache/cache.router.ts` — log the failure through `ILoggingService.debug`
- `src/datasources/cache/cache.router.spec.ts` — case for the circular-reference input
```

```markdown
## Summary
Add `docs/agents/nestjs-patterns.md`, documenting which Nest primitives this repo
uses and how.

## Changes
- `docs/agents/nestjs-patterns.md` — new guide
- `AGENTS.md` — routing-table row for it
```

## Splitting a change

**Rule:** One PR carries one reviewable concern. A PR is too large when any of these is true: it mixes a rename with a behavior change; it mixes a dependency bump with feature work; it changes more than one module for reasons that are not a single mechanical consequence; or a reviewer cannot state what it does in one sentence. Split along the seam, and land the mechanical half first — rename, extract, or bump in PR 1; behavior in PR 2.

**Why:** oversized PRs in this repo have a measured failure mode. A 19-file performance refactor (#2926) was reverted the same day by #3034 because the one bad change in it could not be isolated from the eighteen good ones. Reviewers on large PRs also start deferring: "This PR is already huge. Let's open another PR to rename all such keys" (#3245) is a real review outcome that leaves the repo with a known-wrong name and a follow-up nobody owns.

**Canonical example:** #3197's authors split a TTL-configurability change from the cache-invalidation work it enabled — "for the time saving lets split in 2 PRs" — and shipped the first the same day. A perf change follows the same protocol as its own rule in `caching-and-performance.md`: small, single-concern, measured.

```
# Don't — one PR
feat(queue): add the tx-queue-service client, rename QueueService → TxQueueService,
             bump undici, and switch messages to the new cache keys

# Do — four PRs, in this order
refactor(queue): rename QueueService to TxQueueService
build(deps): bump undici from 8.5.0 to 8.7.0
feat(queue): add the tx-queue-service client
feat(messages): read messages through the tx-queue-service client
```

## Debug and scaffolding artifacts never merge

**Rule:** A local script, a seeded-user helper, a commented-out block, or a `// TODO: transient logging for debugging` line is removed from the branch before the PR is marked ready — not promised away in a review comment.

**Why:** "This file will be removed before merging" (#3245, on `scripts/seed-fake-users.ts` and `scripts/login-as-seeded-user.ts`) is a promise a reviewer has to remember to re-check, and the transient debug-logging block in `src/datasources/cache/cache.first.data.source.ts` — which `best-practices.md` cites as the repo's live anti-example for double-casting — is what happens when nobody does.

## Linking

**Rule:** A PR body links the Linear issue by identifier (`WA-2402`) or full URL, and closes GitHub issues with a `Closes #NNNN` line. Commit subjects carry no issue references — the `(#NNNN)` suffix on `main` is GitHub's, added at squash time, and is never typed by hand.

**Why:** a Linear identifier in the body is what connects the merged commit back to the decision record that authorized it; a hand-typed `(#NNNN)` in a subject collides with the one GitHub appends and produces `(#3295) (#3295)`.

## Enforcement status

Nothing in this guide is machine-checked today. Specifically:

- `.husky/pre-commit` runs `yarn env:validate:silent`, `yarn lint`, and `yarn format` — it does not look at commit messages.
- There is no `.husky/commit-msg` hook and no `commitlint` dependency.
- `.github/workflows/ci.yml` has no PR-title job (its jobs are `license-headers`, `env-validation`, `biome`, `unit-tests`, `integration-tests`, `docker-publish-*`, `autodeploy`).

The gap is on the PR title, since that is what reaches `main`. Adding a `commitlint`-style PR-title check is the enforcement this guide is missing; until it exists, the check happens in review — `reviewing.md` Part 1 routes any PR-shaping change to this guide.

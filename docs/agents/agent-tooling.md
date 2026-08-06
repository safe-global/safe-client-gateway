<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Agent Tooling

The guides in this directory are the content. This file documents the two delivery mechanisms that put them in front of an agent at the right moment — the skills in `.claude/skills/` and the slash commands in `.claude/commands/` — and the conventions for adding to either.

Everything here follows the one-content-home rule: `docs/agents/` holds the content, and everything under `.claude/` is a thin loader that links back to it. A skill or command that starts restating a guide's rules has created a second copy that will drift, and only the guide gets reviewed.

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

## Commands

Slash commands for the workflows that recur here. Each references the relevant guide and skill rather than embedding rules, so a rule changes in one place and every command follows.

| Command | Does | Reads |
|---|---|---|
| `/new-route <module> <description>` | Scaffolds an endpoint: Zod schema → DTO → route service → controller handler → specs. | api-dtos-and-validation, module-structure, security, testing |
| `/new-datasource <module> <api>` | Scaffolds an upstream API client: interface + Symbol token + service + the full cache recipe + specs. | caching-and-performance, module-structure, api-dtos-and-validation, configuration-and-flags |
| `/new-domain-service <module> <description>` | Scaffolds a repository or domain service with its interface, module wiring, and specs. | module-structure, nestjs-patterns, api-dtos-and-validation, testing |
| `/new-env-var <NAME> <purpose>` | Adds a variable across `configuration.ts`, `RootConfigurationSchema`, `.env.sample.json`, and the test config, then validates it. | configuration-and-flags, security |
| `/new-migration <Name> <change>` | Walks the entity + migration flow, including the same-migration index rule and the four-representations checklist. | database-and-migrations, api-dtos-and-validation |
| `/audit-test <path>` | Audits an existing spec against the testing guide and the recurring test remarks (R-001 … R-008). | testing, remarks |
| `/pr-ready` | Runs the author pre-PR checklist against the current diff: both review parts, the remarks scan, the pre-commit commands, and a drafted title and body. | reviewing, remarks, commits-and-prs |

### Spec Kit commands

`speckit.*` — `specify`, `clarify`, `plan`, `tasks`, `implement`, `analyze`, `checklist`, `constitution`, `taskstoissues`. These come from [Spec Kit](https://github.com/github/spec-kit) and are **kept as-is**: they are process commands (idea → spec → tasks), a different job from the repo-specific scaffolding above. They are upstream files — do not hand-edit them; they are replaced wholesale when Spec Kit is updated. Their templates and scripts live in `.specify/`.

Nothing has been retired: before the commands above, `.claude/commands/` held only the `speckit.*` files, and all of them are still current.

### Conventions for adding a command

1. **Reference, never restate.** A command names the skills and guides to load, then lists the steps specific to that workflow. If you find yourself explaining a rule, the rule belongs in a guide.
2. **Idempotent and safe to re-run.** A command inspects current state before writing, and re-running it on already-scaffolded code reports what is already correct instead of duplicating it.
3. **End in verification.** Every command that writes code finishes with `yarn format`, `yarn lint --fix`, and the relevant tests, and requires the **real output** to be reported — [reviewing.md](reviewing.md) treats an unproven "tests pass" as a finding.
4. **Frontmatter:** a one-line `description` (this is what shows in the command list) and an `argument-hint` when the command takes arguments. Use `$ARGUMENTS` in the body.
5. **No SPDX header in a command file**, for the same frontmatter reason as skills.
6. **Name it for the workflow, not the tool.** `/new-env-var`, not `/config-helper`.
7. **Nothing but command files lives under `.claude/commands/`** — a loose markdown file there becomes a command.

A command and a skill covering the same ground is not contention: a command is invoked deliberately by a person who wants the whole sequence (`/new-env-var` walks all five files), while a skill loads on its own to supply a rule mid-task (`cgw-config` fires when a config key gets touched for any reason). `/pr-ready` and `cgw-review`, `/new-migration` and `cgw-database`, `/audit-test` and `cgw-testing` pair up this way by design.

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

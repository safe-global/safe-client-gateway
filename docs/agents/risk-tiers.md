<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Risk Tiers

Every path in this repository has a **risk tier** from 1 (most critical) to 4 (least), and every change and PR inherits a tier from the paths it touches. The tier decides one thing: **how much human review the change needs before it merges, and whether an agent may approve it.**

Read this before starting a task (to know the tier you are implementing at) and before reviewing one (to know what your approval is allowed to mean). The tier is assessed against the code **as it is laid out today** — this document classifies modules where they live, it never asks for code to move.

## The four tiers

| Tier | Blast radius | Agent may implement | Agent may approve | Human approvals required | Who merges |
|---|---|---|---|---|---|
| **1 — Critical** | User funds, keys, identity, what a user signs, or the guardrails that govern agents | Yes, only after a human has agreed the plan | **Never** — agent review is advisory input | **Two**, both maintainers, neither the author | A human |
| **2 — High** | Authorization, money/billing, shared infrastructure, data that feeds a signing flow or another module | Yes | **No** — agent review is advisory input | **One** maintainer, not the author | A human |
| **3 — Moderate** | Read-only display data; a defect is visible and recoverable | Yes | **Yes**, when its review has no findings and CI is green | None — the human who merges is the human check | A human |
| **4 — Low** | No user, fund, or data impact | Yes | **Yes**, when its review has no findings and CI is green | None | An agent may merge |

"Maintainer" means a member of the team `CODEOWNERS` names. "The author" includes the human who directed an agent to write the change: whoever asked for the change cannot also be one of its required approvers.

**Why two humans at Tier 1:** CGW is the internet-facing boundary in front of Safes holding real assets ([security.md](security.md)). A Tier 1 defect is not a bug to roll back — it can be a drained Safe, a relayed transaction paid from our funds, a forged identity, or a user shown the wrong thing before they sign. One reviewer is one blind spot; agent review, however good, is still not accountable.

## How a change gets its tier

### Rule 1 — The highest tier wins

A PR's tier is the **most critical** (lowest-numbered) tier of any file it touches, after escalation (rule 3). A one-line change in `src/modules/auth/` makes the whole PR Tier 1, however much Tier 4 work sits beside it.

To get the low-risk part through faster, split it out into its own PR, but only if it is genuinely independent ([commits-and-prs.md](commits-and-prs.md)'s "Splitting a change"). Splitting one concern into pieces to lower a tier is evasion, and a reviewer treats the pieces as one Tier 1 change.

### Rule 2 — Paths map to tiers

The [tier map](#tier-map) below assigns every path a tier. When a file matches several patterns, the most critical match wins: a path override can only **raise** a module's tier, never lower it. That is how a guard file inside a Tier 3 module is still Tier 1.

**A path matched by no pattern is Tier 2.** A new module, directory or root file is therefore never low-risk by accident. It stays Tier 2 until a PR adds it to the map, and that PR is itself Tier 1 because it edits this file.

Tests take the tier of the module they live in. Weakening an assertion in `src/modules/auth/` is a Tier 1 change, because the test is part of that module's guarantee.

### Rule 3 — Change kinds escalate, wherever they happen

Some changes are dangerous regardless of which module they land in. Each row below raises the change to *at least* the listed tier:

| The diff… | At least |
|---|---|
| Adds, removes, or changes a guard, `@UseGuards(...)`, an auth decorator, or which routes a guard covers | 1 |
| Touches signature recovery/verification, SIWE, JWT issuing or verification, cookies, OIDC, KMS, or field encryption | 1 |
| Adds or changes a Workspace membership/admin/Safe-in-Workspace check, or an `ElevationGuard` gated/ungated entry | 1 |
| Adds or changes a **secret** env var, or how a secret is read, defaulted or logged | 1 |
| Changes what a user is shown for a transaction or message they are about to sign: decoding, previews, human descriptions, safe-shield verdicts, contract/address trust data | 1 |
| Adds a new runtime dependency to `package.json` | 1 |
| Adds a migration that drops, renames, or rewrites existing columns, tables, or rows | 1 |
| Adds or changes a non-secret env var or feature flag | 2 |
| Adds a migration of any other kind | 2 |
| Adds a new state-changing endpoint (`POST`/`PUT`/`PATCH`/`DELETE`) | 2 |
| Changes a cache key, TTL, or invalidation path (`CacheRouter`, `CacheFirstDataSource`, `clear*()`, hook events) | 2 |
| Changes a response shape that a client already consumes (field removed, renamed, retyped, or made nullable) | 2 |
| Bumps an existing dependency version, or changes `yarn.lock` | 2 |
| Changes logging of request or user data | 2 |
| Is a Tier 3 or Tier 4 change of more than 400 changed lines, excluding tests and `yarn.lock` | one tier higher |

### Rule 4 — The tier can be raised, never argued down

The computed tier is a floor. An implementer or reviewer may **raise** it ("this Tier 3 change reorders how balances are fetched for the signing preview — treat it as Tier 1"), and must say why. Nobody lowers it in a PR description or review comment: lowering a tier means changing the map in this file, in its own PR, which is Tier 1.

## Tier map

Patterns are globs relative to the repository root, with `**` meaning any depth. The block below is the machine-readable source of truth: `scripts/risk-tier.ts` parses it to compute and label each PR's tier, so nothing else may keep its own copy (see [Enforcement status](#enforcement-status)). The tables after it explain the choices.

<!-- tier-map:start -->
```yaml
tier1:
  # Identity, authentication and session
  - src/modules/auth/**
  - src/modules/siwe/**
  - src/modules/users/**
  - src/modules/wallets/**
  # Funds movement and signing keys
  - src/modules/relay/**
  - src/modules/safenet/**
  # What a user signs, and the data that tells them whether to sign it
  - src/modules/transactions/**
  - src/modules/messages/**
  - src/modules/data-decoder/**
  - src/modules/human-description/**
  - src/modules/safe-shield/**
  # Who may act on a Safe
  - src/modules/delegate/**
  - src/modules/recovery/**
  - src/modules/policies/**
  - src/modules/owners/**
  # Authorization primitives, wherever they live
  - src/**/guards/**
  - src/**/*.guard.ts
  - src/routes/common/auth/**
  - src/modules/spaces/domain/space-assert.utils.ts
  - src/datasources/jwt/**
  - src/datasources/kms/**
  - scripts/backfill-field-encryption.ts
  - scripts/generate-field-encryption-index-key.ts
  # Process-wide wiring: configuration, the global Nest layer, the HTTP edge
  - src/config/**
  - src/main.ts
  - src/app.*
  - src/middleware/**
  # Build, deploy and supply chain
  - .github/workflows/**
  - .github/CODEOWNERS
  - Dockerfile
  # Agent guardrails, and the check that enforces them
  - docs/agents/risk-tiers.md
  - scripts/risk-tier.ts
  - scripts/risk-tier.spec.ts
  - AGENTS.md
  - CLAUDE.md
  - .claude/settings.json

tier2:
  # Workspaces, money and entitlements
  - src/modules/spaces/**
  - src/modules/billing/**
  - src/modules/entitlements/**
  # Inbound events, outbound user messaging
  - src/modules/hooks/**
  - src/modules/notifications/**
  - src/modules/email/**
  # Safe state and chain configuration consumed by other modules
  - src/modules/chains/**
  - src/modules/safe/**
  - src/modules/safe-queue/**
  - src/modules/counterfactual-safes/**
  - src/modules/estimations/**
  - src/modules/blockchain/**
  - src/modules/backbone/**
  - src/modules/queues/**
  - src/modules/indexing/**
  - src/modules/contracts/**
  # DeFi integrations that build or interpret transaction data
  - src/modules/fees/**
  - src/modules/swaps/**
  - src/modules/bridge/**
  - src/modules/staking/**
  - src/modules/earn/**
  # Shared infrastructure and legacy shared trees
  - src/datasources/**
  - src/domain/**
  - src/routes/**
  - src/logging/**
  - src/validation/**
  - migrations/**
  - db_config/**
  # Toolchain, dependencies and config that gate quality checks
  - package.json
  - yarn.lock
  - .env.sample.json
  - biome.json
  - tsconfig*.json
  - vitest.config.ts
  - .husky/**
  - .pre-commit-config.yaml
  - .github/**
  - .nvmrc
  - .yarnrc.yml
  - .yarn/**
  - .dockerignore
  - LICENSE
  - LICENSE_HEADER.txt
  - NOTICE.md
  # Agent guides and their loaders
  - docs/agents/**
  - .claude/**
  - "**/AGENTS.md"
  - "**/CLAUDE.md"

tier3:
  - src/modules/balances/**
  - src/modules/portfolio/**
  - src/modules/positions/**
  - src/modules/tokens/**
  - src/modules/collectibles/**
  - src/modules/zerion/**
  - src/modules/csv-export/**
  - src/modules/safe-apps/**
  - src/modules/targeted-messaging/**
  - src/modules/alerts/**
  - src/modules/community/**
  - src/__tests__/**
  - test/**
  - scripts/**
  - docker-compose.yml
  - nginx/**
  - .devcontainer/**
  - .vscode/**
  - .specify/**
  - specs/**

tier4:
  - src/modules/about/**
  - src/modules/health/**
  - src/modules/root/**
  - src/modules/surveys/**
  - README.md
  - CONTRIBUTING.md
  - TESTING.md
  - docs/**
  - assets/**
  - .gitignore
  - .git-blame-ignore-revs
```
<!-- tier-map:end -->

### Why each module sits where it does

**Tier 1.**

| Paths | Why |
|---|---|
| `auth`, `siwe`, `users`, `wallets` | Who the caller is. A defect here lets one person act as another; `wallets` also holds field-encrypted data. |
| `relay`, `safenet` | Moves value: relaying spends sponsored gas, and Safenet's payer signs with a KMS key. |
| `transactions`, `messages`, `data-decoder`, `human-description`, `safe-shield` | What a user reads before they sign. A wrong decode, description or "safe" verdict is how a user signs a malicious transaction. |
| `delegate`, `recovery`, `policies`, `owners` | Who is allowed to propose, recover or govern a Safe, and the guard configuration enforced on-chain. |
| Guards, `src/routes/common/auth`, `space-assert.utils.ts`, `jwt`, `kms`, field-encryption scripts | Authorization primitives that every other module trusts. |
| `src/config`, `main.ts`, `src/app.*`, `middleware` | The global guard, interceptor, filter and validation layer, plus every secret's declaration. One change here affects every route at once. |
| `.github/workflows`, `CODEOWNERS`, `Dockerfile` | What gets built, deployed, and who must approve it. |
| `risk-tiers.md`, root `AGENTS.md`/`CLAUDE.md`, `.claude/settings.json` | The rules that bind agents. If an agent can edit them unreviewed, it can lower its own bar. |

**Tier 2.**

| Paths | Why |
|---|---|
| `spaces`, `billing`, `entitlements` | Workspace authorization and paid features. Most mistakes here leak data across tenants or cost money, but none of them signs anything. |
| `hooks`, `notifications`, `email` | Inbound webhooks that drive cache invalidation across modules, and outbound messages users act on. |
| `chains`, `safe`, `safe-queue`, `counterfactual-safes`, `estimations`, `blockchain`, `backbone`, `queues`, `indexing`, `contracts` | Safe state, nonces, chain configuration and upstream URLs that the Tier 1 modules build on. |
| `fees`, `swaps`, `bridge`, `staking`, `earn` | Build or interpret transaction data for third-party protocols. |
| `src/datasources`, `src/domain`, `src/routes`, `logging`, `validation`, `migrations` | Shared infrastructure. A defect here spreads to every consumer, and logging is where PII leaks. |
| Toolchain, dependencies, licensing | They decide what the quality gates check, what code ships, and under what license. |
| `docs/agents/**`, `.claude/**`, nested `AGENTS.md` | They change how agents write and review code, but not the tier rules themselves. |

**Tier 3.** These modules serve read-only display data: balances, portfolio, positions, tokens, collectibles, Zerion, CSV export, Safe Apps, targeted messaging, alerts, community. A defect shows something wrong, a user or monitoring notices, and a fix-forward repairs it. Shared test harnesses, scripts, local-dev and editor configuration, and Spec Kit specs are here too.

**Tier 4.** These are informational endpoints (`about`, `health`, `root`, `surveys`) and non-normative docs. A defect here has no user, fund or data impact. A `docs/` file that defines rules for agents is not Tier 4: `docs/agents/**` is matched first, as Tier 2.

## What this means for an implementer

1. **Work out the tier before writing code.** Use the files you plan to touch plus rule 3. If the work turns out to touch a more critical path than planned, the tier rises with it, and you tell the human you are working with.
2. **Tier 1 needs an agreed plan.** Write down what will change and why, and have a human agree to it before you implement. Keep the diff to that plan; scope creep in a Tier 1 PR is the most expensive kind ([reviewing.md](reviewing.md) Part 2).
3. **State the tier in the PR.** The first line of `## Summary` is `**Risk tier:** <n> — <the path or rule that set it>`, as in [commits-and-prs.md](commits-and-prs.md)'s "PR body". The `Risk tier` check fails without it, or when it is less critical than the changed paths allow.
4. **Never approve or merge your own Tier 1 or Tier 2 work.** An agent never does this, in any role. At Tier 3 and 4, an agent's approval still needs a review with no findings by an agent other than the one that wrote the change.
5. **Never edit the tier map in the same PR that benefits from the edit.** A PR that changes this file is Tier 1. A reviewer flags any tier lowered by a PR that also changes the reclassified paths.

## What this means for a reviewer

1. **Compute the tier yourself from the diff.** Don't trust the tier stated in the PR. If yours is more critical than the stated one, that is a finding, and the stricter tier applies.
2. **Lead the verdict with the tier.** Every review (the pre-commit self-check, `@claude arch-review`, or a human review) starts with the risk tier and what it allows, in the format [reviewing.md](reviewing.md)'s "Reporting format" defines.
3. **Agents:** approve only at Tier 3 or 4, only with no findings, and only when CI is green. At Tier 1 or 2, post the review as a comment and leave the approval to humans. A clean agent review is never a reason for a human to skim a Tier 1 or 2 diff.
4. **Humans at Tier 1** read every changed line, including tests. Each of the two approvals is an independent review, not "LGTM, the other reviewer looked".

## Enforcement status

**Applied automatically today:**

- **Agents learn the rules on their own.**
  - The `cgw-risk-tiers` skill loads this guide whenever a task or review starts.
  - [reviewing.md](reviewing.md) requires the tier at the top of every review. The review hook that runs before each commit applies it, and so does the `Architecture Check` workflow (`@claude arch-review`).
- **CI computes the tier.** The `Risk tier` workflow (`.github/workflows/risk-tier.yml`, script `scripts/risk-tier.ts`) runs on every PR:
  - It parses the `tier-map` block above and computes the tier from the changed paths. A rename counts its old path too, and the size row of rule 3 applies.
  - It writes the result to the job summary and labels the PR `tier-1` to `tier-4`.
  - Its `Compute risk tier` job **fails** when the PR description has no `**Risk tier:** <n>` line, or states a less critical tier than the one computed.
  - It reads the map and the script from the PR's **base** commit, so a PR can't lower its own tier by editing them.
  - Fork PRs get the check but no label, because their token is read-only.
- **The repository keeps the map honest.** `scripts/risk-tier.spec.ts` runs in `yarn test`. It fails when a module under `src/modules/` has no explicit tier, so a new module can't silently default, and when a pattern no longer matches any file.

**What the CI check does not do:**

- It doesn't compute the content-based escalations of rule 3 (guards, signatures, secrets, migrations, new dependencies, signing-flow display data). The reviewer applies those. The computed tier is a floor, not the final word.
- It doesn't block a merge on its own. Until the items below are configured, an agent that ignores this guide is caught only by review and a red check.

**Still needed, as repository settings rather than code (admin only):**

1. **Make the check required.** Add `Compute risk tier` as a required status check in branch protection for `main`.
2. **Gate approvals on the tier.**
   - Tier 1 and Tier 2 paths are owned in `CODEOWNERS` by a human-only maintainers team, and branch protection requires code-owner review, so no bot approval satisfies them.
   - Tier 1 additionally requires two approvals. One way is a ruleset that needs two approvals on PRs labelled `tier-1`. Another is two owning teams that must both approve.
   - A dedicated review bot gets approve rights and approves only PRs labelled `tier-3` or `tier-4`.

Item 2 is the only part an agent can't get around, so this guide should not be considered fully enforced until it is in place.

---
name: cgw-module-structure
description: Use when creating a new module in safe-client-gateway, moving or renaming files, naming a file or a class, versioning a controller, or wiring Symbol-based DI. Covers the canonical module skeleton (module file plus domain/ mandatory, routes/ only with endpoints, datasources/ only with an owned API), the naming table, the one sanctioned controller-versioning style, the Symbol-DI recipe, the import-other-modules-via-domain-only rule, the frozen legacy trees (src/routes/, src/domain/, src/datasources/), the deviant modules not to imitate, and the new-module checklist. Triggers on "new module", "where do I put this file", "rename", "move", "naming convention", "controller version", "v2 endpoint", "Symbol DI".
---

# CGW Module Structure

Read **[docs/agents/module-structure.md](../../../docs/agents/module-structure.md)** before creating or moving anything. This skill is a loader; the doc is the content.

Two non-negotiables from [AGENTS.md](../../../AGENTS.md) live here:

- **New feature code goes in `src/modules/<kebab>/`** following the canonical skeleton — never in `src/routes/`, `src/domain/`, or `src/datasources/`. Those three are frozen legacy trees; `src/datasources/` takes cross-cutting infrastructure only (cache, db, network, jwt, kms, job-queue, storage, circuit-breaker). A new external API client belongs in its own module's `datasources/`.
- **Imports use the `@/` alias only, and reach other modules only through their `domain/`.** Importing another module's `routes/` or `datasources/` is a layering violation.

The doc also names the five structurally deviant modules (portfolio, safe-shield, csv-export, email, owners) and what specifically not to copy from each — they pass their tests and are still not the pattern. Four controller-versioning styles coexist in the tree; only one is current.

For the Nest primitives themselves (provider forms, DI gotchas, filters) load **cgw-nestjs-patterns**.

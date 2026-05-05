<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Agent Guidelines

This document contains guidelines for AI agents (like Claude Code) working on this codebase.

## Engineering Manual

Before changing module structure, route/controller/service/repository layering,
DTOs, schemas, datasources, database entities, migrations, or auth/user flows,
read the CGW-local engineering manual:

- Start with `docs/engineering/README.md`
- Read `docs/engineering/code-conventions.md` before a coding task
- Run `docs/engineering/pr-self-review-checklist.md` before opening or
  finishing a PR
- For current module conventions and known exceptions, read
  `docs/engineering/research/module-inventory.md`

The manual records how this repository works. Do not apply generic NestJS
structure when the local convention is more specific.

## Change Design

Follow the ID-based rules in `docs/engineering/code-conventions.md`, especially
when adding files, providers, interfaces, factories, injection tokens, helpers,
DTOs, module exports, persistence workflows, or new telemetry.

## Architecture

The common CGW route flow is:

```text
Controller -> Route service -> Repository -> Datasource -> CacheFirstDataSource
```

- **Controllers**: HTTP boundary code with route, guard, pipe, and Swagger
  decorators.
- **Route services**: product orchestration; call repositories, not low-level
  datasources.
- **Repositories**: domain-data boundary; validate datasource/DB results and
  map expected persistence errors.
- **Datasources**: HTTP/cache/external adapter code; use `HttpErrorFactory` for
  external API errors.

Check `docs/engineering/code-conventions.md` and
`docs/engineering/research/module-inventory.md` before changing that layering
or choosing where an interface, repository, datasource, DTO, or schema belongs.
For unsettled layout choices, use `docs/engineering/open-question-options.md`.

When adding constructor dependencies, update all spec files that instantiate
the class.

## Pre-Commit Checklist

Before creating **EACH** commit, you MUST run the following commands in sequence and fix any issues:

1. **Format the code:**

   ```bash
   yarn format
   ```

2. **Run linter and fix issues:**

   ```bash
   yarn lint --fix
   ```

   If there are any remaining lint errors, fix them manually before proceeding.

3. **Run tests:**

   ```bash
   yarn test
   ```

   All tests must pass before committing. If tests fail, fix the issues before proceeding.

## Commit Workflow

The correct workflow for making commits is:

```bash
# 1. Make your code changes
# 2. Run quality checks
yarn format
yarn lint --fix
yarn test

# 3. Only after all checks pass, commit
git add <files>
git commit -m "Your commit message"
```

## License Headers

All source files changed after Feb 16th 2026 **must** include an SPDX license header at the very top of the file. The header format depends on the file type:

| File type                            | Comment style | Header                                    |
| ------------------------------------ | ------------- | ----------------------------------------- |
| `.ts`, `.tsx`, `.js`, `.mjs`         | `//`          | `// SPDX-License-Identifier: FSL-1.1-MIT` |
| `.yaml`, `.yml`, `.sh`, `Dockerfile` | `#`           | `# SPDX-License-Identifier: FSL-1.1-MIT`  |
| `.md`                                | HTML comment  | Multi-line: `<!--\n  SPDX-...\n -->`      |
| `.sql`                               | `--`          | `-- SPDX-License-Identifier: FSL-1.1-MIT` |

For `.md` files the hook uses a multi-line HTML comment style (`<!--| | -->`), so the header spans three lines.

This is enforced by a `pre-commit` hook (`insert-license` from `Lucas-C/pre-commit-hooks`) and a `license-headers` CI job. The canonical header text lives in `LICENSE_HEADER.txt`.

Every file you create or modify in a PR **MUST** have the correct license header. Add it yourself — do not rely on the pre-commit hook to do it for you. If the pre-commit hook adds it automatically, include that change in your commit.

## Important Notes

- **Never skip these steps** - even for "minor" changes
- **Never commit** if any of these commands fail
- If tests fail, investigate and fix the root cause
- If lint errors persist after `--fix`, manually resolve them
- These checks help maintain code quality and prevent breaking changes

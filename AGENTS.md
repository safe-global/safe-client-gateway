<!-- SPDX-License-Identifier: FSL-1.1-MIT -->

# Agent Guidelines

This document contains guidelines for AI agents (like Claude Code) working on this codebase.

## Architecture

```
Controller → Service → Repository → Datasource → CacheFirstDataSource
```

- **Datasources** (`src/datasources/`): HTTP + caching, use `HttpErrorFactory` for errors
- **Repositories** (`src/modules/*/domain/`): Inject datasources, validate with Zod schemas
- **Services** (`src/modules/*/routes/`): Business logic, call repositories (never datasources)

Each external API gets its own datasource:

- Interface in `src/domain/interfaces/` (Symbol-based DI)
- Implementation in `src/datasources/<api-name>/`
- Own NestJS module exporting the interface

When adding constructor dependencies, update all spec files that instantiate the class.

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

All source files **must** include an SPDX license header as the very first line. The header format depends on the file type:

| File type                            | Comment style | Header                                          |
| ------------------------------------ | ------------- | ----------------------------------------------- |
| `.ts`, `.tsx`, `.js`, `.mjs`         | `//`          | `// SPDX-License-Identifier: FSL-1.1-MIT`       |
| `.yaml`, `.yml`, `.sh`, `Dockerfile` | `#`           | `# SPDX-License-Identifier: FSL-1.1-MIT`        |
| `.md`                                | HTML comment  | `<!-- SPDX-License-Identifier: FSL-1.1-MIT -->` |
| `.sql`                               | `--`          | `-- SPDX-License-Identifier: FSL-1.1-MIT`       |

This is enforced by a `pre-commit` hook (`insert-license` from `Lucas-C/pre-commit-hooks`) and a `license-headers` CI job. The canonical header text lives in `LICENSE_HEADER.txt`.

If you create or modify a file and the pre-commit hook adds the header automatically, include that change in your commit. If CI fails on `license-headers`, add the missing header manually.

## Important Notes

- **Never skip these steps** - even for "minor" changes
- **Never commit** if any of these commands fail
- If tests fail, investigate and fix the root cause
- If lint errors persist after `--fix`, manually resolve them
- These checks help maintain code quality and prevent breaking changes

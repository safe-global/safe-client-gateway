<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Testing Guide

The testing guide moved to [docs/agents/testing.md](docs/agents/testing.md) — the single home for agent/developer guidelines (routing table: [AGENTS.md](AGENTS.md)).

## Quick reference

Tests run on Bun's built-in test runner (`bun:test`).

```bash
# Run all unit tests (default config from package.json)
bun run test

# Run unit tests explicitly (src/ and scripts/ minus *.integration.spec.ts and *.e2e.spec.ts)
bun run test:unit

# Run unit tests with coverage
bun run test:unit:cov

# Run integration tests (*.integration.spec.ts; needs Postgres, Redis and RabbitMQ)
bun run test:integration

# Run integration tests with coverage
bun run test:integration:cov

# Run all tests (unit, then integration, then e2e)
bun run test:all

# Run in watch mode
bun run test:watch
```

**Note**: `bun run test` and `bun run test:unit` are equivalent. A path appended to these scripts adds to their own `src scripts` filters rather than narrowing them, so run a single file directly:

```bash
# unit spec
bun --no-env-file --env-file=.env.test test ./path/to/file.spec.ts

# integration or e2e spec
bun --no-env-file --env-file=.env.test test --preload ./test/e2e-setup.ts --timeout=60000 ./path/to/file.integration.spec.ts
```

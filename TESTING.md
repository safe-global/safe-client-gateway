<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Testing Guide

The testing guide moved to [docs/agents/testing.md](docs/agents/testing.md) — the single home for agent/developer guidelines (routing table: [AGENTS.md](AGENTS.md)).

## Quick reference

```bash
# Run all unit tests (default config from package.json)
yarn test

# Run unit tests explicitly (the `unit` project in vitest.config.ts)
yarn test:unit

# Run unit tests with coverage
yarn test:unit:cov

# Run integration tests (the `integration` project in vitest.config.ts)
yarn test:integration

# Run integration tests with coverage
yarn test:integration:cov

# Run all tests (unit + integration)
yarn test:all

# Run in watch mode
yarn test:watch
```

**Note**: `yarn test` and `yarn test:unit` are equivalent — both run the `unit` project defined in `vitest.config.ts`.

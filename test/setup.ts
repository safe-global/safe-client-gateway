// SPDX-License-Identifier: FSL-1.1-MIT
// Preloaded for every `bun test` run (see bunfig.toml).

import { beforeEach, jest } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { faker } from '@faker-js/faker';

// Bun 1.4.2: an `AsyncLocalStorage#enterWith()` made while a test file is
// being evaluated leaves every test in that file unsettled until it times out.
// `nestjs-cls` makes one at import time (a root context that only mitigates a
// Node.js < 24 context leak), so load it here, once, with `enterWith` stubbed
// out for the duration of that import. Runtime code uses `als.run()`.
const { enterWith } = AsyncLocalStorage.prototype;
AsyncLocalStorage.prototype.enterWith = (): void => undefined;
await import('nestjs-cls');
AsyncLocalStorage.prototype.enterWith = enterWith;

// Seed faker per test file so a failing run's data can be reproduced: the seed
// is printed, and re-running with FAKER_SEED=<n> reproduces the exact values.
const seed = process.env.FAKER_SEED
  ? Number(process.env.FAKER_SEED)
  : faker.seed();

faker.seed(seed);

console.info(`[faker] seed=${seed}`);

// `jest.resetAllMocks()` keeps the implementation a mock was created with,
// as it did under Vitest 4: `jest.fn(impl)` comes back as `impl`, not as a
// bare mock returning `undefined`. Shared pass-through doubles (e.g.
// `createMockWalletEncryptionService`) are built once per suite and rely on
// this to survive the per-test reset. Only `jest.fn` is tracked, not `mock()`.
type Implementation = Parameters<typeof jest.fn>[0];
type MockFunction = ReturnType<typeof jest.fn>;
const createdWithImplementation: Array<
  [mock: WeakRef<MockFunction>, implementation: NonNullable<Implementation>]
> = [];
const createMock = jest.fn;
jest.fn = ((implementation?: Implementation): MockFunction => {
  const mock = createMock(implementation);
  if (implementation) {
    createdWithImplementation.push([new WeakRef(mock), implementation]);
  }
  return mock;
}) as typeof jest.fn;
const resetAllMocks = jest.resetAllMocks;
jest.resetAllMocks = (): void => {
  resetAllMocks();
  for (const [mock, implementation] of createdWithImplementation) {
    mock.deref()?.mockImplementation(implementation);
  }
};

// Start every test with empty mock call history (Jest's `clearMocks`):
// implementations are kept, recorded calls and results are dropped.
beforeEach(() => {
  jest.clearAllMocks();
});

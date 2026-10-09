// SPDX-License-Identifier: FSL-1.1-MIT
import { expect } from 'bun:test';
export const checkGuardIsApplied = (
  guard: abstract new (...args: Array<any>) => unknown,
  fn: (...args: Array<any>) => unknown,
): void => {
  const guards: Array<() => void> = Reflect.getMetadata('__guards__', fn);
  expect(guards?.length ?? 0).toBeGreaterThan(0);
  expect(guards.map((g) => g.name)).toContain(guard.name);
};

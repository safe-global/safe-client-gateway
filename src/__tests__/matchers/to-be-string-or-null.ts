// SPDX-License-Identifier: FSL-1.1-MIT
import { expect } from 'vitest';

const anyStringOrNull = (
  actual: unknown,
): { message: () => string; pass: boolean } => {
  const pass = actual === null || typeof actual === 'string';
  return {
    message: () => `expected ${actual} to be string or null`,
    pass,
  };
};

expect.extend({
  anyStringOrNull,
});

declare module 'vitest' {
  interface Assertion<T = any> {
    anyStringOrNull(): T;
  }

  interface AsymmetricMatchersContaining {
    anyStringOrNull(): void;
  }
}

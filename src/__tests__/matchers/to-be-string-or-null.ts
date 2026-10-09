// SPDX-License-Identifier: FSL-1.1-MIT
import { expect } from 'bun:test';

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

declare module 'bun:test' {
  interface Matchers<T> {
    anyStringOrNull(): void;
  }

  interface AsymmetricMatchers {
    anyStringOrNull(): void;
  }
}

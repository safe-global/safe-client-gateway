// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Jest/Vitest-compatible signatures for the equality matchers. `bun:test` types
 * `expected` as the received value's type, which rejects comparing a datasource's
 * `Raw<T>` (a `symbol` to the type system) with the `T` it holds, or a value
 * with an asymmetric matcher of another type.
 */
declare module 'bun:test' {
  interface Matchers<T> {
    toBe<E>(expected: E): void;
    toEqual<E>(expected: E): void;
    toStrictEqual<E>(expected: E): void;
    toContain<E>(expected: E): void;
    toContainEqual<E>(expected: E): void;
  }
}

export {};

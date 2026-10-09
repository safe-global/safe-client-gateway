// SPDX-License-Identifier: FSL-1.1-MIT
import { type Mock as BunMock, jest } from 'bun:test';

/**
 * Mock wrapper types for `bun:test`.
 *
 * `bun:test` ships `Mock<T>` but not Jest's `Mocked*` helpers, so they are
 * defined here once, mirroring Jest's shapes, for typing hand-built mocks such
 * as `{ get: jest.fn() } as MockedObject<ICacheService>`.
 */

type FunctionLike = (...args: any) => any;

interface ClassLike {
  new (...args: any): any;
}

/**
 * `bun:test`'s `Mock<T>` with Jest's default type argument, so a bare `Mock`
 * types any mock function.
 */
export type Mock<T extends FunctionLike = FunctionLike> = BunMock<T>;

export type MockInstance<T extends FunctionLike = FunctionLike> = Mock<
  NormalizedFunction<T>
>;

/**
 * `T` with its generics erased, as Vitest/Jest type a mock's implementation:
 * `mockImplementation` on a mocked `<T>(key: string) => T` then accepts any
 * `(key: string) => unknown` rather than only a function generic in `T`.
 */
type NormalizedFunction<T extends FunctionLike> = (
  ...args: Parameters<T>
) => ReturnType<T>;

export type MockedFunction<T extends FunctionLike> = T &
  Mock<NormalizedFunction<T>> & {
    [K in keyof T]: T[K];
  };

export type MockedClass<T extends ClassLike> = T &
  Mock<(...args: ConstructorParameters<T>) => InstanceType<T>> & {
    [K in keyof T]: T[K];
  };

/**
 * Shallow: methods become {@link Mock}s, other properties keep their type.
 */
export type MockedObject<T> = {
  [K in keyof T]: T[K] extends FunctionLike ? MockedFunction<T[K]> : T[K];
} & T;

/**
 * Deep: nested objects are mocked recursively.
 */
export type Mocked<T> = T extends ClassLike
  ? MockedClass<T>
  : T extends FunctionLike
    ? MockedFunction<T>
    : T extends object
      ? { [K in keyof T]: Mocked<T[K]> } & T
      : T;

/**
 * Types an already-mocked value as {@link Mocked}. Purely a type-level helper
 * (Jest's `jest.mocked`), it returns its argument unchanged.
 */
export function mocked<T>(source: T): Mocked<T> {
  return source as Mocked<T>;
}

/**
 * Copies `actual` with every function export replaced by a bare `jest.fn()`,
 * for `mock.module(id, () => automock(actual))`. `bun:test` has no automock,
 * so this stands in for Jest's factory-less `jest.mock(id)`.
 *
 * Snapshot `actual` (a namespace import of the real module) before calling
 * `mock.module`, which rewrites that namespace's bindings in place.
 */
export function automock<T extends object>(actual: T): T {
  return Object.fromEntries(
    Object.entries(actual).map(([key, value]) => [
      key,
      typeof value === 'function' ? jest.fn() : value,
    ]),
  ) as T;
}

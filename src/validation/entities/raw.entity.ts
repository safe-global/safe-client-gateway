/**
 * Represents a type that has not been validated yet but should be
 * before being used.
 *
 * @example
 * ```typescript
 * function log(value: number) {
 *   console.log(value);
 * }
 *
 * const value = 69420 as Raw<number>
 *
 * log(value); // errors
 * log(z.number().parse(value)); // works
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Raw<_> = symbol;

export function rawify<T>(value: T): Raw<T> {
  return value as Raw<T>;
}

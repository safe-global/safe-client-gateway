/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ValueTransformer } from 'typeorm';

/**
 * Note: numeric enums have reverse mappings so we can't interact with them
 * as we would normally do an object on both a type and runtime level.
 * Object.keys will return all keys/values, as will keyof.
 */

type NumericEnum = { [key: string]: number | string; [key: number]: string };

export function getEnumKey<T extends NumericEnum>(
  enumObj: T,
  value: number,
): keyof T {
  const key = enumObj[value];
  if (typeof key !== 'string') {
    throw new Error(`Invalid enum value: ${value}`);
  }
  return key;
}

export const databaseEnumTransformer = <T extends NumericEnum>(
  enumObj: T,
): ValueTransformer => {
  return {
    to: <K extends keyof T>(key: K): T[K] => {
      const value = enumObj[key];

      if (value === undefined) {
        throw new Error(`Invalid enum key: ${String(key)}`);
      }

      return value;
    },
    from: (value: number): keyof T => {
      const key = getEnumKey(enumObj, value);

      if (key === undefined) {
        throw new Error(`Invalid enum value: ${value}`);
      }

      return key;
    },
  };
};

/**
 * The following is a workaround to get only the string keys of a numeric enum
 * as a tuple, as `keyof` will return all keys/values due to reverse mapping.
 *
 * Returned as a tuple, it is useful for zod enum validation, e.g. z.enum([...])
 *
 * @param enumObj - numeric enum object
 * @returns string keys as a strictly typed tuple
 */
export function getStringEnumKeys<T extends NumericEnum>(
  enumObj: T,
): NumericEnumKeysTuple<T> {
  return Object.keys(enumObj).filter((key) =>
    isNaN(Number(key)),
  ) as NumericEnumKeysTuple<T>;
}

type NumericEnumKeysTuple<T> = UnionToTuple<ExcludeNumberKeys<T>>;

type ExcludeNumberKeys<T> = Exclude<keyof T, `${number}`>;

// Recursively removes last element of union and pushes it to tuple
type UnionToTuple<T, R extends Array<any> = []> = [T] extends [never]
  ? R
  : UnionToTuple<Exclude<T, LastOf<T>>, [LastOf<T>, ...R]>;

// Gets the last element of a union
type LastOf<T> =
  UnionToIntersection<T extends any ? (x: T) => 0 : never> extends (
    x: infer Last,
  ) => 0
    ? Last
    : never;

// Converts a union to an intersection of functions
type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
  x: infer I,
) => any
  ? I
  : never;

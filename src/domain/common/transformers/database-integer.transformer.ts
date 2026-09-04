// SPDX-License-Identifier: FSL-1.1-MIT
import type { ValueTransformer } from 'typeorm';

/**
 * `bigint` columns come back from node-postgres as strings so they cannot
 * silently lose precision; a column whose values stay below
 * `Number.MAX_SAFE_INTEGER` can be read back as a number.
 */
export const databaseIntegerTransformer: ValueTransformer = {
  to(value: number): number {
    return value;
  },
  from(value: string | number): number {
    return Number(value);
  },
};

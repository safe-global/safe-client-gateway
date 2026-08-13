// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Renders a set of allowed string values as a quoted SQL `IN` list, so an
 * entity's CHECK constraint or partial-index predicate derives from the same
 * `const` array or enum the application validates against instead of
 * repeating its values.
 *
 * The matching migration keeps its own literal list: migrations are frozen
 * snapshots of the schema at a point in time, and must not shift when an enum
 * grows later.
 */
export function toSqlList(values: ReadonlyArray<string>): string {
  return values.map((value) => `'${value}'`).join(',');
}

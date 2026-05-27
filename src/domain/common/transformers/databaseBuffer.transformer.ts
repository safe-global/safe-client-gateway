// SPDX-License-Identifier: FSL-1.1-MIT
import type { ValueTransformer } from 'typeorm';

/**
 * Normalises Postgres `bytea` round-trips to Node `Buffer`.
 *
 * On read, the `pg` driver hands back a `Uint8Array` (or a `Buffer` depending
 * on driver version). Callers in our domain layer rely on `Buffer`-specific
 * methods (`equals`, `subarray`, `toString('hex' | 'base64url')`), so we
 * normalise once here instead of sprinkling `Buffer.from(...)` at every read
 * site.
 *
 * On write, TypeORM accepts a `Buffer` directly — we pass through unchanged.
 */
export const databaseBufferTransformer: ValueTransformer = {
  to(value: Buffer): Buffer {
    return value;
  },
  from(value: Buffer | Uint8Array): Buffer {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
};

// SPDX-License-Identifier: FSL-1.1-MIT
type Primitive = string | number | bigint | boolean | undefined | symbol | null;

export interface NetworkRequest {
  headers?: Record<string, string>;
  params?: Record<string, Primitive | ReadonlyArray<Primitive>>;
  timeout?: number;
  circuitBreaker?: { key: string };
}

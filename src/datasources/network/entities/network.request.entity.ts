// SPDX-License-Identifier: FSL-1.1-MIT
type Primitive = string | number | bigint | boolean | undefined | symbol | null;

export interface NetworkRequest {
  headers?: Record<string, string>;
  // An array value is appended once per element.
  params?: Record<string, Primitive | Array<Primitive>>;
  timeout?: number;
  circuitBreaker?: { key: string };
  responseType?: 'json' | 'text';
}

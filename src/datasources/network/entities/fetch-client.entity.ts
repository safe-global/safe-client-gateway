// SPDX-License-Identifier: FSL-1.1-MIT
import type { NetworkRequest } from '#/datasources/network/entities/network.request.entity';
import type { NetworkResponse } from '#/datasources/network/entities/network.response.entity';

// Lives apart from NetworkModule so FetchNetworkService can inject it without
// an import cycle: under ES module evaluation a cyclic `const` is still in its
// temporal dead zone when the decorator that reads it runs.
export const FetchClientToken = Symbol('FetchClient');

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
  timeout?: number,
  circuitBreaker?: NetworkRequest['circuitBreaker'],
  responseType?: NetworkRequest['responseType'],
) => Promise<NetworkResponse<T>>;

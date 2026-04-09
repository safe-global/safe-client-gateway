// SPDX-License-Identifier: FSL-1.1-MIT
import type { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';

export const FetchClientToken = Symbol('FetchClient');

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
  timeout?: number,
  circuitBreaker?: NetworkRequest['circuitBreaker'],
) => Promise<NetworkResponse<T>>;

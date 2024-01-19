import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { FetchClient } from '@/datasources/network/network.module';
import {
  NetworkResponseError,
  NetworkRequestError,
  NetworkOtherError,
} from '@/datasources/network/entities/network.error.entity';

/**
 * A {@link INetworkService} which uses fetch as the main HTTP client
 */
@Injectable()
export class FetchNetworkService implements INetworkService {
  constructor(
    @Inject('FetchClient')
    private readonly client: FetchClient,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async get<T, R = NetworkResponse<T>>(
    baseUrl: string,
    { params, ...options }: NetworkRequest = {},
  ): Promise<R> {
    const url = this.buildUrl(baseUrl, params);
    const startTimeMs = performance.now();
    try {
      return (await this.client(url, {
        method: 'GET',
        ...options,
      })) as R;
    } catch (error) {
      this.handleError(error, performance.now() - startTimeMs);
    }
  }

  async post<T, R = NetworkResponse<T>>(
    baseUrl: string,
    data: object,
    { params, headers }: NetworkRequest = {},
  ): Promise<R> {
    const url = this.buildUrl(baseUrl, params);
    const startTimeMs = performance.now();
    try {
      return (await this.client(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      })) as R;
    } catch (error) {
      this.handleError(error, performance.now() - startTimeMs);
    }
  }

  async delete<T, R = NetworkResponse<T>>(
    url: string,
    data?: object,
  ): Promise<R> {
    const startTimeMs = performance.now();
    try {
      return (await this.client(url, {
        method: 'DELETE',
        ...(data && {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }),
      })) as R;
    } catch (error) {
      this.handleError(error, performance.now() - startTimeMs);
    }
  }

  private buildUrl(baseUrl: string, params = {}): string {
    const urlObject = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        urlObject.searchParams.append(key, value);
      }
    }

    return urlObject.toString();
  }

  private handleError(error, responseTimeMs: number): never {
    if (error.response) {
      this.logErrorResponse(error, responseTimeMs);
      throw new NetworkResponseError(
        error.response.status,
        error.response.data,
      );
    } else if (error.request) {
      throw new NetworkRequestError(error.request);
    } else {
      throw new NetworkOtherError(error.message);
    }
  }

  private logErrorResponse(error, responseTimeMs: number): void {
    this.loggingService.debug({
      type: 'external_request',
      protocol: error.request.protocol,
      target_host: error.request.host,
      path: error.request.pathname,
      request_status: error.response.status,
      detail: error.response.statusText,
      response_time_ms: responseTimeMs,
    });
  }
}

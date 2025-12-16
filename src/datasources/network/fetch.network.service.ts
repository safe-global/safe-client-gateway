import { Inject, Injectable, Optional } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { FetchClient } from '@/datasources/network/network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';

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
    @Optional()
    private readonly defaultHeaders?: Record<string, string>,
  ) {}

  async get<T>(args: {
    url: string;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>> {
    const url = this.buildUrl(args.url, args.networkRequest?.params);
    this.logRequest(url, 'GET');
    const startTimeMs = performance.now();
    try {
      return await this.client<T>(
        url,
        {
          method: 'GET',
          headers: this.mergeHeaders(args.networkRequest?.headers),
        },
        args.networkRequest?.timeout,
        args.networkRequest?.circuitBreaker,
      );
    } catch (error) {
      this.logErrorResponse(error, performance.now() - startTimeMs);
      throw error;
    }
  }

  async post<T>(args: {
    url: string;
    data?: object;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>> {
    const url = this.buildUrl(args.url, args.networkRequest?.params);
    this.logRequest(url, 'POST');
    const startTimeMs = performance.now();
    try {
      return await this.client<T>(
        url,
        {
          method: 'POST',
          body: JSON.stringify(args.data),
          headers: this.mergeHeaders(args.networkRequest?.headers, {
            'Content-Type': 'application/json',
          }),
        },
        args.networkRequest?.timeout,
        args.networkRequest?.circuitBreaker,
      );
    } catch (error) {
      this.logErrorResponse(error, performance.now() - startTimeMs);
      throw error;
    }
  }

  async delete<T>(args: {
    url: string;
    data?: object;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>> {
    const url = this.buildUrl(args.url, args.networkRequest?.params);
    this.logRequest(url, 'DELETE');
    const startTimeMs = performance.now();

    const contentTypeHeader = args.data
      ? { 'Content-Type': 'application/json' }
      : undefined;

    try {
      return await this.client<T>(
        url,
        {
          method: 'DELETE',
          ...(args.data && {
            body: JSON.stringify(args.data),
          }),
          headers: this.mergeHeaders(
            args.networkRequest?.headers,
            contentTypeHeader,
          ),
        },
        args.networkRequest?.timeout,
        args.networkRequest?.circuitBreaker,
      );
    } catch (error) {
      this.logErrorResponse(error, performance.now() - startTimeMs);
      throw error;
    }
  }

  private mergeHeaders(
    requestHeaders?: Record<string, string>,
    methodHeaders?: Record<string, string>,
  ): Record<string, string> | undefined {
    const hasDefaultHeaders =
      this.defaultHeaders && Object.keys(this.defaultHeaders).length > 0;
    if (!hasDefaultHeaders && !methodHeaders) {
      return requestHeaders;
    }
    const merged = {
      ...this.defaultHeaders,
      ...methodHeaders,
      ...requestHeaders,
    };
    return merged;
  }

  private buildUrl(
    baseUrl: string,
    params: Record<string, NonNullable<NetworkRequest['params']>[string]> = {},
  ): string {
    const urlObject = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') {
        urlObject.searchParams.append(key, String(value));
      }
    }

    return urlObject.toString();
  }

  /**
   * Logs the request properties. This is useful for debugging and monitoring purposes.
   * TODO: remove this method when the Safe Transaction Service implements the request_id header.
   * @param url
   * @param method
   */
  private logRequest(url: string, method: string): void {
    this.loggingService.info({
      type: LogType.ExternalRequest,
      method,
      url,
    });
  }

  private logErrorResponse(error: unknown, responseTimeMs: number): void {
    if (!(error instanceof NetworkResponseError)) {
      return;
    }

    this.loggingService.debug({
      type: LogType.ExternalRequest,
      protocol: error.url.protocol,
      target_host: error.url.host,
      path: error.url.pathname,
      request_status: error.response.status,
      detail: error.response.statusText,
      response_time_ms: responseTimeMs,
    });
  }
}

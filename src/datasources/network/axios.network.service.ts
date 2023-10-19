import { Axios } from 'axios';
import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  NetworkResponseError,
  NetworkRequestError,
  NetworkOtherError,
} from '@/datasources/network/entities/network.error.entity';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';

/**
 * A {@link INetworkService} which uses Axios as the main HTTP client
 */
@Injectable()
export class AxiosNetworkService implements INetworkService {
  constructor(
    @Inject('AxiosClient') private readonly client: Axios,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async get<T = any, R = NetworkResponse<T>>(
    url: string,
    config?: NetworkRequest,
  ): Promise<R> {
    const startTimeMs: number = performance.now();
    try {
      return await this.client.get(url, config);
    } catch (error) {
      this.handleError(error, performance.now() - startTimeMs);
    }
  }

  async post<T = any, R = NetworkResponse<T>>(
    url: string,
    data: object,
    config?: NetworkRequest,
  ): Promise<R> {
    const startTimeMs: number = performance.now();
    try {
      return await this.client.post(url, data, config);
    } catch (error) {
      this.handleError(error, performance.now() - startTimeMs);
    }
  }

  async delete<T = any, R = NetworkResponse<T>>(
    url: string,
    data?: object,
  ): Promise<R> {
    const startTimeMs: number = performance.now();
    try {
      return await this.client.delete(url, { data: data });
    } catch (error) {
      this.handleError(error, performance.now() - startTimeMs);
    }
  }

  private handleError(error, responseTimeMs): never {
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

  private logErrorResponse(error, responseTimeMs) {
    this.loggingService.debug({
      type: 'external_request',
      protocol: error.request.protocol,
      target_host: error.request.host,
      path: error.request.path,
      request_status: error.response.status,
      detail: error.response.statusText,
      response_time_ms: responseTimeMs,
    });
  }
}

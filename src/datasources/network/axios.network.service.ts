import { Inject, Injectable } from '@nestjs/common';
import { INetworkService } from './network.service.interface';
import { NetworkResponse } from './entities/network.response.entity';
import { NetworkRequest } from './entities/network.request.entity';
import { Axios } from 'axios';
import {
  NetworkOtherError,
  NetworkRequestError,
  NetworkResponseError,
} from './entities/network.error.entity';

/**
 * A {@link INetworkService} which uses Axios as the main HTTP client
 */
@Injectable()
export class AxiosNetworkService implements INetworkService {
  constructor(@Inject('AxiosClient') private readonly client: Axios) {}

  async get<T = any, R = NetworkResponse<T>>(
    url: string,
    config?: NetworkRequest,
  ): Promise<R> {
    try {
      return await this.client.get(url, config);
    } catch (error) {
      if (error.response) {
        throw new NetworkResponseError(
          error.response.data,
          error.response.status,
        );
      } else if (error.request) {
        throw new NetworkRequestError(error.request);
      } else {
        throw new NetworkOtherError(error.message);
      }
    }
  }
}

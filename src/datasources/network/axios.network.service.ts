import { Inject, Injectable } from '@nestjs/common';
import { INetworkService } from './network.service.interface';
import { NetworkResponse } from './entities/network.response.entity';
import { NetworkRequest } from './entities/network.request.entity';
import { Axios } from 'axios';

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
    return this.client.get(url, config);
  }
}

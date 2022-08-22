import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { INetworkService } from './network.service.interface';
import { NetworkResponse } from './entities/network.response.entity';
import { NetworkRequest } from './entities/network.request.entity';

/**
 * A {@link INetworkService} which uses Axios as the main HTTP client
 */
@Injectable()
export class AxiosNetworkService implements INetworkService {
  constructor(private readonly httpService: HttpService) {}

  async get<T = any, R = NetworkResponse<T>>(url: string, config?: NetworkRequest): Promise<R> {
    return this.httpService.axiosRef.get(url, config);
  }
}

import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';

export const NetworkService = Symbol('INetworkService');

export interface INetworkService {
  get<T>(args: {
    url: string;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>>;

  post<T>(args: {
    url: string;
    data: object;
    networkRequest?: NetworkRequest;
    headers?: Record<string, string>; // Optional headers
  }): Promise<NetworkResponse<T>>;

  delete<T>(args: {
    url: string;
    data?: object;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>>;
}

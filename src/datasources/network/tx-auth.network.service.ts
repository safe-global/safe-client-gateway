import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import type { NetworkResponse } from '@/datasources/network/entities/network.response.entity';

/**
 * Decorates the base {@link INetworkService} to add Tx API auth when
 * running in development against the public Transaction Service.
 */
@Injectable()
export class TxAuthNetworkService implements INetworkService {
  private readonly isDevelopment: boolean;
  private readonly useVpcUrl: boolean;
  private readonly apiKey: string | undefined;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isDevelopment = this.configurationService.getOrThrow<boolean>(
      'application.isDevelopment',
    );
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
    this.apiKey = this.configurationService.get<string | undefined>(
      'safeTransaction.apiKey',
    );
  }

  get<T>(args: {
    url: string;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>> {
    return this.networkService.get<T>(this.withAuth(args));
  }

  post<T>(args: {
    url: string;
    data?: object;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>> {
    return this.networkService.post<T>(this.withAuth(args));
  }

  delete<T>(args: {
    url: string;
    data?: object;
    networkRequest?: NetworkRequest;
  }): Promise<NetworkResponse<T>> {
    return this.networkService.delete<T>(this.withAuth(args));
  }

  private withAuth<TArgs extends { networkRequest?: NetworkRequest }>(
    args: TArgs,
  ): TArgs {
    if (!(this.isDevelopment && !this.useVpcUrl) || !this.apiKey) {
      return args;
    }

    // Only add auth header when in development, and using the public Tx Service and API key is set
    return {
      ...args,
      networkRequest: {
        ...args.networkRequest,
        headers: {
          ...(args.networkRequest?.headers ?? {}),
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    };
  }
}

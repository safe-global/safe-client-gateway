import { Inject, Injectable } from '@nestjs/common';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Injectable()
export class GelatoApi implements IRelayApi {
  /**
   * If you are using your own custom gas limit, please add a 150k gas buffer on top of the expected
   * gas usage for the transaction. This is for the Gelato Relay execution overhead, and adding this
   * buffer reduces your chance of the task cancelling before it is executed on-chain.
   * @see https://docs.gelato.network/developer-services/relay/quick-start/optional-parameters
   */
  private static GAS_LIMIT_BUFFER = BigInt(150_000);

  private readonly baseUri: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('relay.baseUri');
  }

  async getRelayCount(args: {
    chainId: string;
    address: string;
  }): Promise<number> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    const currentCount = await this.cacheService.get(cacheDir);
    return currentCount ? parseInt(currentCount) : 0;
  }

  async relay(args: {
    chainId: string;
    to: string;
    data: string;
    gasLimit?: string;
  }): Promise<{ taskId: string }> {
    const relayResponse = await this.sponsoredCall(args);

    await this.incrementRelayCount({
      chainId: args.chainId,
      address: args.to,
    }).catch((error) => {
      // If we fail to increment count, we should not fail the relay
      this.loggingService.warn(error.message);
    });

    return relayResponse;
  }

  private async sponsoredCall(args: {
    chainId: string;
    to: string;
    data: string;
    gasLimit?: string;
  }): Promise<{ taskId: string }> {
    const sponsorApiKey = this.configurationService.getOrThrow<string>(
      `gelato.apiKey.${args.chainId}`,
    );

    try {
      const url = `${this.baseUri}/relays/v2/sponsored-call`;
      const { data } = await this.networkService.post<{ taskId: string }>(url, {
        sponsorApiKey,
        chainId: args.chainId,
        target: args.to,
        data: args.data,
        ...(args.gasLimit && {
          gasLimit: this.getRelayGasLimit(args.gasLimit),
        }),
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private getRelayGasLimit(gasLimit: string): string {
    return (BigInt(gasLimit) + GelatoApi.GAS_LIMIT_BUFFER).toString();
  }

  private async incrementRelayCount(args: {
    chainId: string;
    address: string;
  }): Promise<void> {
    const currentCount = await this.getRelayCount(args);
    const incremented = currentCount + 1;
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    return this.cacheService.set(cacheDir, incremented.toString());
  }
}

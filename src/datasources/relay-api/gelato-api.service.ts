import { Inject, Injectable } from '@nestjs/common';
import { GelatoRelay } from '@gelatonetwork/relay-sdk';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { RelayPayload } from '@/domain/relay/limit-addresses.mapper';
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

  constructor(
    @Inject('GelatoRelayClient')
    private readonly relayClient: GelatoRelay,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async getRelayCount(args: {
    chainId: string;
    address: string;
  }): Promise<number> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    const currentCount = await this.cacheService.get(cacheDir);
    return currentCount ? parseInt(currentCount) : 0;
  }

  async relay(args: RelayPayload): Promise<{ taskId: string }> {
    const apiKey = this.configurationService.getOrThrow<string>(
      `gelato.apiKey.${args.chainId}`,
    );

    const gasLimit = args.gasLimit
      ? this.getRelayGasLimit(args.gasLimit)
      : undefined;

    const relayResponse = await this.relayClient.sponsoredCall(
      {
        chainId: BigInt(args.chainId),
        data: args.data,
        target: args.to,
      },
      apiKey,
      {
        gasLimit,
      },
    );

    await this.incrementRelayCount({
      chainId: args.chainId,
      address: args.to,
    }).catch((error) => {
      // If we fail to increment count, we should not fail the relay
      this.loggingService.warn(error.message);
    });

    return relayResponse;
  }

  private getRelayGasLimit(gasLimit: bigint): bigint {
    return gasLimit + GelatoApi.GAS_LIMIT_BUFFER;
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

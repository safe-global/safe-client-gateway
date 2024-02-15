import { Inject, Injectable } from '@nestjs/common';
import { RelayLimitReachedError } from '@/domain/relay/errors/relay-limit-reached.error';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';

@Injectable()
export class RelayRepository {
  // Number of relay requests per ttl
  private readonly limit: number;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly limitAddressesMapper: LimitAddressesMapper,
    @Inject(IRelayApi)
    private readonly relayApi: IRelayApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.limit = configurationService.getOrThrow('relay.limit');
  }

  async relay(relayPayload: {
    chainId: string;
    to: string;
    data: string;
    gasLimit?: string;
  }): Promise<{ taskId: string }> {
    const relayAddresses =
      await this.limitAddressesMapper.getLimitAddresses(relayPayload);

    for (const address of relayAddresses) {
      const canRelay = await this.canRelay({
        chainId: relayPayload.chainId,
        address,
      });
      if (!canRelay.result) {
        const error = new RelayLimitReachedError(
          address,
          canRelay.currentCount,
          this.limit,
        );
        this.loggingService.info(error.message);
        throw error;
      }
    }

    const relayResponse = await this.relayApi.relay(relayPayload);

    // If we fail to increment count, we should not fail the relay
    await Promise.allSettled(
      relayAddresses.map((address) => {
        return this.incrementRelayCount({
          chainId: relayPayload.chainId,
          address,
        });
      }),
    );

    return relayResponse;
  }

  async getRelayCount(args: {
    chainId: string;
    address: string;
  }): Promise<number> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    const currentCount = await this.cacheService.get(cacheDir);
    return currentCount ? parseInt(currentCount) : 0;
  }

  private async canRelay(args: {
    chainId: string;
    address: string;
  }): Promise<{ result: boolean; currentCount: number }> {
    const currentCount = await this.getRelayCount(args);
    return { result: currentCount < this.limit, currentCount };
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

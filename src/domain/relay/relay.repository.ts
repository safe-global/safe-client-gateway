import { Inject, Injectable } from '@nestjs/common';
import { RelayLimitReachedError } from '@/domain/relay/errors/relay-limit-reached.error';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

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
  ) {
    this.limit = configurationService.getOrThrow('relay.limit');
  }

  async relay(args: {
    version: string;
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    gasLimit: bigint | null;
  }): Promise<{ taskId: string }> {
    const relayAddresses =
      await this.limitAddressesMapper.getLimitAddresses(args);

    for (const address of relayAddresses) {
      const canRelay = await this.canRelay({
        chainId: args.chainId,
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

    const relayResponse = await this.relayApi.relay(args);

    // If we fail to increment count, we should not fail the relay
    for (const address of relayAddresses) {
      await this.incrementRelayCount({
        chainId: args.chainId,
        address,
      }).catch((error) => {
        // If we fail to increment count, we should not fail the relay
        this.loggingService.warn(error.message);
      });
    }

    return relayResponse;
  }

  async getRelayCount(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<number> {
    return this.relayApi.getRelayCount(args);
  }

  private async canRelay(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<{ result: boolean; currentCount: number }> {
    const currentCount = await this.getRelayCount(args);
    return { result: currentCount < this.limit, currentCount };
  }

  private async incrementRelayCount(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<void> {
    const currentCount = await this.getRelayCount(args);
    const incremented = currentCount + 1;
    return this.relayApi.setRelayCount({
      chainId: args.chainId,
      address: args.address,
      count: incremented,
    });
  }
}

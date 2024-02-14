import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  LimitAddressesMapper,
  RelayPayload,
} from '@/domain/relay/limit-addresses.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

// TODO: Move to error folder and create exception filter
class RelayLimitReachedError extends Error {
  constructor(
    readonly address: Hex,
    readonly current: number,
    readonly limit: number,
  ) {
    super(
      `Relay limit reached for ${address} | current: ${current} | limit: ${limit}`,
    );
  }
}

@Injectable({})
export class RelayRepository {
  // Number of relay requests per ttl
  private readonly limit: number;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly limitAddressesMapper: LimitAddressesMapper,
    private readonly relayApi: IRelayApi,
  ) {
    this.limit = configurationService.getOrThrow('relay.limit');
  }

  async relay(relayPayload: RelayPayload): Promise<{ taskId: string }> {
    const relayAddresses =
      this.limitAddressesMapper.getLimitAddresses(relayPayload);
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

    return this.relayApi.relay(relayPayload);
  }

  private async canRelay(args: {
    chainId: string;
    address: string;
  }): Promise<{ result: boolean; currentCount: number }> {
    const currentCount = await this.getRelayCount(args);
    return { result: currentCount < this.limit, currentCount };
  }

  getRelayCount(args: { chainId: string; address: string }): Promise<number> {
    return this.relayApi.getRelayCount(args);
  }
}

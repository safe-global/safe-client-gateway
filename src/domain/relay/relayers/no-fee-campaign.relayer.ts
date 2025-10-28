import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IRelayer } from '@/domain/relay/interfaces/relayer.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Relay, RelaySchema } from '@/domain/relay/entities/relay.entity';
import { RelayLimitReachedError } from '@/domain/relay/errors/relay-limit-reached.error';
import { BalancesService } from '@/routes/balances/balances.service';
import {
  NoFeeCampaignConfiguration,
  RelayRules,
} from '@/domain/relay/entities/relay.configuration';

@Injectable()
export class NoFeeCampaignRelayer implements IRelayer {
  private readonly relayConfiguration: NoFeeCampaignConfiguration;
  private static readonly DEFAULT_FIAT_CODE = 'USD';

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly limitAddressesMapper: LimitAddressesMapper,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
    @Inject(BalancesService) private readonly balancesService: BalancesService,
  ) {
    this.relayConfiguration = configurationService.getOrThrow(
      'relay.noFeeCampaign',
    );
  }

  async canRelay(args: {
    chainId: string;
    address: Address;
  }): Promise<{ result: boolean; currentCount: number; limit: number }> {
    const chainConfiguration = this.relayConfiguration[parseInt(args.chainId)];

    if (!chainConfiguration) {
      return { result: false, currentCount: 0, limit: 0 };
    }

    if (!this.isActive(args.chainId)) {
      // Outside no-fee campaign
      return { result: false, currentCount: 0, limit: 0 };
    }

    const currentSafeTokenBalance = await this.getTokenBalance(args);
    const currentCount = await this.getRelayCount(args);

    // Get the appropriate limit based on Safe token balance using relay rules
    const relayLimit = this.getLimit(
      currentSafeTokenBalance,
      chainConfiguration.relayRules,
    );
    return {
      result: currentCount < relayLimit,
      currentCount,
      limit: relayLimit,
    };
  }

  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
    gasLimit: bigint | null;
  }): Promise<Relay> {
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
          canRelay.limit,
        );
        this.loggingService.info(error.message);
        throw error;
      }
    }

    const maxGasLimit = BigInt(
      this.relayConfiguration[parseInt(args.chainId)].maxGasLimit,
    );

    let gasLimit: bigint;
    if (args.gasLimit === null || args.gasLimit > maxGasLimit) {
      gasLimit = maxGasLimit;
    } else {
      gasLimit = args.gasLimit;
    }

    const relayResponse = await this.relayApi
      .relay({
        ...args,
        gasLimit,
      })
      .then(RelaySchema.parse);

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

  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }> {
    const chainConfiguration = this.relayConfiguration[parseInt(args.chainId)];

    if (!chainConfiguration) {
      return { remaining: 0, limit: 0 };
    }

    if (this.isActive(args.chainId)) {
      const currentSafeTokenBalance = await this.getTokenBalance(args);
      const currentCount = await this.getRelayCount(args);

      // Get the appropriate limit based on Safe token balance using relay rules
      const relayLimit = this.getLimit(
        currentSafeTokenBalance,
        chainConfiguration.relayRules,
      );

      return {
        remaining: Math.max(relayLimit - currentCount, 0),
        limit: relayLimit,
      };
    } else {
      // Outside no-fee campaign window for configured chains - no relays allowed
      return {
        remaining: 0,
        limit: 0,
      };
    }
  }

  private async getRelayCount(args: {
    chainId: string;
    address: Address;
  }): Promise<number> {
    if (!this.isActive(args.chainId)) {
      return 0;
    }
    return this.relayApi.getRelayCount(args);
  }

  private async incrementRelayCount(args: {
    chainId: string;
    address: Address;
  }): Promise<void> {
    if (this.isActive(args.chainId)) {
      const currentCount = await this.getRelayCount(args);
      const incremented = currentCount + 1;

      const ttlSeconds =
        this.relayConfiguration[parseInt(args.chainId)].endsAtTimeStamp -
        new Date().getTime() / 1000;

      return this.relayApi.setRelayCount({
        chainId: args.chainId,
        address: args.address,
        count: incremented,
        ttlSeconds: ttlSeconds,
      });
    }
  }

  private getLimit(tokenBalance: number, relayRules: RelayRules): number {
    // Sort rules by balance ascending to ensure proper range checking
    const sortedRules = relayRules.sort((a, b) => a.balance - b.balance);

    for (const rule of sortedRules) {
      if (tokenBalance <= rule.balance) {
        return rule.limit;
      }
    }

    // If balance exceeds all thresholds, return the highest limit
    return sortedRules[sortedRules.length - 1].limit;
  }

  private async getTokenBalance(args: {
    chainId: string;
    address: Address;
  }): Promise<number> {
    const chainConfiguration = this.relayConfiguration[parseInt(args.chainId)];

    if (!chainConfiguration) return 0;

    try {
      const balance = await this.balancesService.getTokenBalance({
        chainId: args.chainId,
        safeAddress: args.address,
        fiatCode: NoFeeCampaignRelayer.DEFAULT_FIAT_CODE,
        tokenAddress: chainConfiguration.safeTokenAddress,
      });

      if (!balance) {
        return 0;
      }

      // Convert balance to token units (divide by 10^decimals)
      const tokenDecimals = balance.tokenInfo.decimals;
      const balanceInWei = BigInt(balance.balance);
      const tokenBalance = Number(balanceInWei) / Math.pow(10, tokenDecimals);

      return tokenBalance;
    } catch (error) {
      // If we fail to get token balance, return 0 (safest fallback)
      this.loggingService.warn(`Failed to get token balance: ${error}`);
      return 0;
    }
  }

  private isActive(chainId: string): boolean {
    const chainConfiguration = this.relayConfiguration[parseInt(chainId)];
    const unixTimestampNow: number = new Date().getTime() / 1000;

    // Return false of configuration for no-fee campaign is absent
    if (!chainConfiguration || !chainConfiguration.safeTokenAddress) {
      return false;
    }

    const hasStarted = unixTimestampNow >= chainConfiguration.startsAtTimeStamp;
    const hasNotEnded = unixTimestampNow <= chainConfiguration.endsAtTimeStamp;

    return hasStarted && hasNotEnded;
  }
}

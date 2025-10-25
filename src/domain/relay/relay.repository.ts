import { Inject, Injectable } from '@nestjs/common';
import { RelayLimitReachedError } from '@/domain/relay/errors/relay-limit-reached.error';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Relay, RelaySchema } from '@/domain/relay/entities/relay.entity';
import type { Address } from 'viem';
import { BalancesService } from '@/routes/balances/balances.service';
import { NoFeeCampaignConfiguration } from '@/domain/relay/entities/relay.configuration';

@Injectable()
export class RelayRepository {
  // Number of relay requests per ttl
  private readonly limit: number;
  private readonly noFeeCampaignConfiguration: NoFeeCampaignConfiguration;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly limitAddressesMapper: LimitAddressesMapper,
    @Inject(IRelayApi)
    private readonly relayApi: IRelayApi,
    @Inject(BalancesService) private readonly balancesService: BalancesService,
  ) {
    this.limit = configurationService.getOrThrow('relay.limit');
    this.noFeeCampaignConfiguration = configurationService.getOrThrow(
      'relay.noFeeCampaign',
    );
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

    const relayResponse = await this.relayApi
      .relay(args)
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

  private async getRelayCount(args: {
    chainId: string;
    address: Address;
  }): Promise<number> {
    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(args.chainId)];
    if (noFeeCampaignConfigurationPerChain === undefined) {
      return this.relayApi.getRelayCount(args);
    }

    if (this.isnoFeeCampaignActive(args.chainId)) {
      return this.getRelayNoFeeCampaignCount(args);
    } else {
      return 0;
    }
  }

  private async canRelay(args: {
    chainId: string;
    address: Address;
  }): Promise<{ result: boolean; currentCount: number; limit: number }> {
    // No-fee November feature
    // If configuration is present, check Safe token balance to determine relay eligibility
    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(args.chainId)];
    if (noFeeCampaignConfigurationPerChain === undefined) {
      const currentCount = await this.getRelayCount(args);
      return {
        result: currentCount < this.limit,
        currentCount,
        limit: this.limit,
      };
    }

    if (this.isnoFeeCampaignActive(args.chainId)) {
      const currentSafeTokenBalance = await this.getTokenBalance(args);
      const currentCount = await this.getRelayCount(args);

      // Get the appropriate limit based on Safe token balance using relay rules
      const relayLimit = this.getnoFeeCampaignLimit(
        currentSafeTokenBalance,
        noFeeCampaignConfigurationPerChain.relayRules,
      );
      return {
        result: currentCount < relayLimit,
        currentCount,
        limit: relayLimit,
      };
    } else {
      // Outside no-fee campaign
      return { result: false, currentCount: 0, limit: 0 };
    }
  }

  private async incrementRelayCount(args: {
    chainId: string;
    address: Address;
  }): Promise<void> {
    if (this.isnoFeeCampaignActive(args.chainId)) {
      const currentCount = await this.getRelayNoFeeCampaignCount(args);
      const incremented = currentCount + 1;
      return this.relayApi.setRelayNoFeeCampaignCount({
        chainId: args.chainId,
        address: args.address,
        count: incremented,
      });
    }

    const currentCount = await this.getRelayCount(args);
    const incremented = currentCount + 1;
    return this.relayApi.setRelayCount({
      chainId: args.chainId,
      address: args.address,
      count: incremented,
    });
  }

  private getnoFeeCampaignLimit(
    tokenBalance: number,
    relayRules: Array<{ balance: number; limit: number }>,
  ): number {
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
    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(args.chainId)];

    if (!noFeeCampaignConfigurationPerChain) return 0;

    try {
      const balance = await this.balancesService.getTokenBalance({
        chainId: args.chainId,
        safeAddress: args.address,
        fiatCode: 'USD', // Using USD as default fiat code
        tokenAddress: noFeeCampaignConfigurationPerChain.safeTokenAddress,
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

  private isnoFeeCampaignActive(chainId: string): boolean {
    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(chainId)];
    const unixTimestampNow: number = new Date().getTime() / 1000;

    // Return false of configuration for no-fee campaign is absent
    if (!noFeeCampaignConfigurationPerChain) return false;

    const hasStarted =
      unixTimestampNow >= noFeeCampaignConfigurationPerChain.startsAtTimeStamp;
    const hasNotEnded =
      unixTimestampNow <= noFeeCampaignConfigurationPerChain.endsAtTimeStamp;

    return hasStarted && hasNotEnded;
  }

  private async getRelayNoFeeCampaignCount(args: {
    chainId: string;
    address: Address;
  }): Promise<number> {
    return this.relayApi.getRelayNoFeeCampaignCount(args);
  }

  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }> {
    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(args.chainId)];

    // If chain has no-fee campaign configuration, use no-fee campaign logic
    if (noFeeCampaignConfigurationPerChain !== undefined) {
      if (this.isnoFeeCampaignActive(args.chainId)) {
        const currentSafeTokenBalance = await this.getTokenBalance(args);
        const currentCount = await this.getRelayCount(args);

        // Get the appropriate limit based on Safe token balance using relay rules
        const relayLimit = this.getnoFeeCampaignLimit(
          currentSafeTokenBalance,
          noFeeCampaignConfigurationPerChain.relayRules,
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

    // Fallback to normal relay limits for chains without no-fee campaign configuration
    const currentCount = await this.getRelayCount(args);
    return {
      remaining: Math.max(this.limit - currentCount, 0),
      limit: this.limit,
    };
  }
}

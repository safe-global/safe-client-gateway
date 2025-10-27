import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IRelayManager } from '@/domain/relay/interfaces/relay-manager.interface';
import { IRelayer } from '@/domain/relay/interfaces/relayer.interface';
import { DailyLimitRelayer } from '@/domain/relay/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/domain/relay/relayers/no-fee-campaign.relayer';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NoFeeCampaignConfiguration } from '@/domain/relay/entities/relay.configuration';
import { Relay } from '@/domain/relay/entities/relay.entity';

@Injectable()
export class RelayManager implements IRelayManager {
  private readonly noFeeCampaignConfiguration: NoFeeCampaignConfiguration;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly dailyLimitRelayer: DailyLimitRelayer,
    private readonly noFeeCampaignRelayer: NoFeeCampaignRelayer,
  ) {
    this.noFeeCampaignConfiguration = configurationService.getOrThrow(
      'relay.noFeeCampaign',
    );
  }

  getRelayer(chainId: string): IRelayer {
    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(chainId)];

    // If chain has no-fee campaign configuration, use no-fee campaign relayer
    if (noFeeCampaignConfigurationPerChain !== undefined) {
      return this.noFeeCampaignRelayer;
    }

    // Otherwise, use daily limit relayer
    return this.dailyLimitRelayer;
  }

  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
    gasLimit: bigint | null;
  }): Promise<Relay> {
    const relayer = this.getRelayer(args.chainId);
    return relayer.relay(args);
  }

  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }> {
    const relayer = this.getRelayer(args.chainId);
    return relayer.getRelaysRemaining(args);
  }
}

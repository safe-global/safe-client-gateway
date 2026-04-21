// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';
import { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  RelayFeeConfiguration,
  NoFeeCampaignConfiguration,
} from '@/modules/relay/domain/entities/relay.configuration';

@Injectable()
export class RelayManager implements IRelayManager {
  private readonly noFeeCampaignConfiguration: NoFeeCampaignConfiguration;
  private readonly dailyLimitRelayChainIds: Array<string>;
  private readonly relayFeeConfiguration: RelayFeeConfiguration;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly dailyLimitRelayer: DailyLimitRelayer,
    private readonly noFeeCampaignRelayer: NoFeeCampaignRelayer,
    private readonly relayFeeRelayer: RelayFeeRelayer,
  ) {
    this.noFeeCampaignConfiguration = configurationService.getOrThrow(
      'relay.noFeeCampaign',
    );

    this.dailyLimitRelayChainIds = configurationService.getOrThrow(
      'relay.dailyLimitRelayerChainsIds',
    );

    this.relayFeeConfiguration = configurationService.getOrThrow('relay.fee');
  }

  /**
   * Returns the appropriate relayer for the given chain.
   * Priority order:
   * 1. {@link RelayFeeRelayer} — when the chain is in `relay.fee.enabledChainIds`
   * 2. {@link DailyLimitRelayer} — when the chain is in `relay.dailyLimitRelayerChainsIds`
   * 3. {@link NoFeeCampaignRelayer} — when the chain has a no-fee campaign configuration
   * 4. {@link DailyLimitRelayer} — fallback for backward compatibility
   *
   * @param chainId - Chain ID to look up the relayer for
   * @returns The relayer to use for this chain
   */
  public getRelayer(chainId: string): IRelayer {
    // relay-fee takes first priority when enabled for the chain
    if (this.relayFeeConfiguration.enabledChainIds.includes(chainId)) {
      return this.relayFeeRelayer;
    }

    if (this.dailyLimitRelayChainIds.includes(chainId)) {
      return this.dailyLimitRelayer;
    }

    const noFeeCampaignConfigurationPerChain =
      this.noFeeCampaignConfiguration[parseInt(chainId)];

    // If chain has no-fee campaign configuration, use no-fee campaign relayer
    if (noFeeCampaignConfigurationPerChain !== undefined) {
      return this.noFeeCampaignRelayer;
    }

    // Fallback, to use daily limit relayer. This is to ensure backward compatibility if dailyLimitRelayChainIds is not set becuase of missing environment variable.
    return this.dailyLimitRelayer;
  }
}

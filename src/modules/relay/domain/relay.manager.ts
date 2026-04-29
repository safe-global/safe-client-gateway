// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';
import { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
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
    private readonly signerFactoryDecoder: SignerFactoryDecoder,
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
   * Returns the appropriate relayer for the given chain and (optionally) the
   * transaction calldata. Priority order:
   * 1. {@link DailyLimitRelayer} — for `createSigner` calls (passkey signer
   *    deployment is always sponsored, regardless of chain config)
   * 2. {@link RelayFeeRelayer} — when the chain is in `relay.fee.enabledChainIds`
   * 3. {@link DailyLimitRelayer} — when the chain is in `relay.dailyLimitRelayerChainsIds`
   * 4. {@link NoFeeCampaignRelayer} — when the chain has a no-fee campaign configuration
   * 5. {@link DailyLimitRelayer} — fallback for backward compatibility
   *
   * @param chainId - Chain ID to look up the relayer for
   * @param data - Transaction calldata; required to detect createSigner
   * @returns The relayer to use
   */
  public getRelayer(chainId: string, data?: Address): IRelayer {
    // Passkey signer deployment via SafeWebAuthnSignerFactory.createSigner is
    // always sponsored — it must not be subject to noFeeCampaign balance-based
    // rules or relay-fee charges, so route it straight to the daily-limit
    // relayer regardless of chain config. The factory address is verified
    // downstream in LimitAddressesMapper.
    if (data && this.signerFactoryDecoder.helpers.isCreateSigner(data)) {
      return this.dailyLimitRelayer;
    }

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

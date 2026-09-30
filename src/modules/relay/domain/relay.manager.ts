// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Hex } from 'viem';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { GasPaymentOptionUnavailableError } from '@/modules/relay/domain/errors/gas-payment-option-unavailable.error';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';

type ChainRelayer = NonNullable<Chain['relayer']>;

/** What a relayed calldata does, which determines who may pay for it. */
const RelayCall = {
  SIGNER_CREATION: 'SIGNER_CREATION',
  SAFE_CREATION: 'SAFE_CREATION',
  REFUNDING_TRANSACTION: 'REFUNDING_TRANSACTION',
  TRANSACTION: 'TRANSACTION',
} as const;

type RelayCall = (typeof RelayCall)[keyof typeof RelayCall];

@Injectable()
export class RelayManager implements IRelayManager {
  constructor(
    private readonly dailyLimitRelayer: DailyLimitRelayer,
    private readonly noFeeCampaignRelayer: NoFeeCampaignRelayer,
    private readonly relayFeeRelayer: RelayFeeRelayer,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  /**
   * Returns the relayer that pays for the calldata on the chain:
   * - signer creation → {@link DailyLimitRelayer}, regardless of chain config
   * - Safe creation → {@link DailyLimitRelayer} if `safeCreationSponsored`
   * - refunding transaction → {@link RelayFeeRelayer} if `PAY_FROM_SAFE` is listed
   * - any other transaction → the free relayer, see {@link getFreeRelayer}
   *
   * @throws GasPaymentOptionUnavailableError when a refunding transaction can't
   *   use `PAY_FROM_SAFE`.
   * @throws NoRelayerDefinedError when the chain offers no option for the calldata.
   * @throws RelayerTypeNotImplementedError when the relayer type is GTF, except
   *   for signer creation.
   */
  public getRelayer({
    relayer,
    data,
  }: {
    relayer: Chain['relayer'];
    data: Hex;
  }): IRelayer {
    switch (this.getRelayCall(data)) {
      // Always sponsored.
      case RelayCall.SIGNER_CREATION:
        return this.dailyLimitRelayer;
      // Sponsored only when the chain sets `safeCreationSponsored`.
      case RelayCall.SAFE_CREATION:
        return this.getSafeCreationRelayer(this.requireRelayer(relayer));
      // Paid by the Safe only when the chain lists `PAY_FROM_SAFE`.
      case RelayCall.REFUNDING_TRANSACTION:
        return this.getRefundingRelayer(relayer);
      // Free only when the chain lists a free option.
      case RelayCall.TRANSACTION:
        return this.getFreeRelayer(relayer);
    }
  }

  /**
   * Returns the relayer whose free quota the chain offers.
   *
   * @throws NoRelayerDefinedError when the chain lists no free option.
   * @throws RelayerTypeNotImplementedError when the relayer type is GTF.
   */
  public getFreeRelayer(relayer: Chain['relayer']): IRelayer {
    const { gasPaymentOptions } = this.requireRelayer(relayer);
    // The no-fee campaign takes precedence over the daily limit.
    if (gasPaymentOptions.includes(GasPaymentOption.NO_FEE_CAMPAIGN)) {
      return this.noFeeCampaignRelayer;
    }
    if (gasPaymentOptions.includes(GasPaymentOption.FREE_DAILY_LIMIT)) {
      return this.dailyLimitRelayer;
    }
    throw new NoRelayerDefinedError();
  }

  private getSafeCreationRelayer(relayer: ChainRelayer): IRelayer {
    if (!relayer.safeCreationSponsored) {
      throw new NoRelayerDefinedError();
    }
    return this.dailyLimitRelayer;
  }

  private getRefundingRelayer(relayer: Chain['relayer']): IRelayer {
    if (!relayer) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.PAY_FROM_SAFE,
        reason: 'NO_RELAYER',
        available: [],
      });
    }
    const { gasPaymentOptions } = this.requireRelayer(relayer);
    if (!gasPaymentOptions.includes(GasPaymentOption.PAY_FROM_SAFE)) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.PAY_FROM_SAFE,
        reason: 'NOT_LISTED',
        available: gasPaymentOptions,
      });
    }
    return this.relayFeeRelayer;
  }

  private getRelayCall(data: Hex): RelayCall {
    if (this.relayTransactionHelper.isCreateSigner(data)) {
      return RelayCall.SIGNER_CREATION;
    }
    if (this.proxyFactoryDecoder.helpers.isCreateProxyWithNonce(data)) {
      return RelayCall.SAFE_CREATION;
    }
    if (this.relayTransactionHelper.hasRefundingTransaction(data)) {
      return RelayCall.REFUNDING_TRANSACTION;
    }
    return RelayCall.TRANSACTION;
  }

  private requireRelayer(relayer: Chain['relayer']): ChainRelayer {
    if (!relayer) {
      throw new NoRelayerDefinedError();
    }
    if (relayer.type === RelayerType.GTF) {
      throw new RelayerTypeNotImplementedError(RelayerType.GTF);
    }
    return relayer;
  }
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from "@nestjs/common";
import type { Address } from "viem";
import { SignerFactoryDecoder } from "@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper";
import {
  RelayerType,
  type RelayerType as RelayerTypeValue,
} from "@/modules/relay/domain/entities/relayer-type.entity";
import { NoRelayerDefinedError } from "@/modules/relay/domain/errors/no-relayer-defined.error";
import { RelayerTypeNotImplementedError } from "@/modules/relay/domain/errors/relayer-type-not-implemented.error";
import { IRelayManager } from "@/modules/relay/domain/interfaces/relay-manager.interface";
import { IRelayer } from "@/modules/relay/domain/interfaces/relayer.interface";
import { DailyLimitRelayer } from "@/modules/relay/domain/relayers/daily-limit.relayer";
import { NoFeeCampaignRelayer } from "@/modules/relay/domain/relayers/no-fee-campaign.relayer";
import { RelayFeeRelayer } from "@/modules/relay/domain/relayers/relay-fee.relayer";

@Injectable()
export class RelayManager implements IRelayManager {
  constructor(
    private readonly dailyLimitRelayer: DailyLimitRelayer,
    private readonly noFeeCampaignRelayer: NoFeeCampaignRelayer,
    private readonly relayFeeRelayer: RelayFeeRelayer,
    private readonly signerFactoryDecoder: SignerFactoryDecoder,
  ) {}

  /**
   * Returns the appropriate relayer for the given chain's relayer type and
   * (optionally) the transaction calldata. Routing:
   * 1. {@link DailyLimitRelayer} — for `createSigner` calls (passkey signer
   *    deployment is always sponsored, regardless of chain config)
   * 2. Otherwise dispatch on `relayerType`:
   *    - `RELAY_FEE` → {@link RelayFeeRelayer}
   *    - `DAILY_LIMIT` → {@link DailyLimitRelayer}
   *    - `NO_FEE_CAMPAIGN` → {@link NoFeeCampaignRelayer}
   *    - `GTF` → throws {@link RelayerTypeNotImplementedError}
   *    - `null` → throws {@link NoRelayerDefinedError}
   */
  public getRelayer(
    relayerType: RelayerTypeValue | null,
    data?: Address,
  ): IRelayer {
    // Passkey signer deployment via SafeWebAuthnSignerFactory.createSigner is
    // always sponsored — it must bypass the chain-configured relayer, so route
    // it straight to the daily-limit relayer regardless of relayerType. The
    // factory address is verified downstream in LimitAddressesMapper.
    if (data && this.signerFactoryDecoder.helpers.isCreateSigner(data)) {
      return this.dailyLimitRelayer;
    }

    switch (relayerType) {
      case RelayerType.RELAY_FEE:
        return this.relayFeeRelayer;
      case RelayerType.DAILY_LIMIT:
        return this.dailyLimitRelayer;
      case RelayerType.NO_FEE_CAMPAIGN:
        return this.noFeeCampaignRelayer;
      case RelayerType.GTF:
        throw new RelayerTypeNotImplementedError(RelayerType.GTF);
      default:
        throw new NoRelayerDefinedError();
    }
  }
}

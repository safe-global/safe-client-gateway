// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

export type NoFeeCampaignConfiguration = Record<
  number,
  {
    startsAtTimeStamp: number;
    endsAtTimeStamp: number;
    maxGasLimit: number;
    safeTokenAddress: Address;
    relayRules: RelayRules;
  }
>;

export type RelayRule = {
  balanceMin: bigint;
  balanceMax: bigint;
  limit: number;
};

export type RelayRules = Array<RelayRule>;

/** Configuration for the relay-fee (Pay with Safe) relayer and fee service integration. */
export type RelayFeeConfiguration = {
  /** Chain IDs for which Pay with Safe / relay-fee is enabled */
  enabledChainIds: Array<string>;
  /** Base URL of the fee service API */
  baseUri: string;
  /** TTL in seconds for cached fee preview responses; set to 0 to disable caching */
  feePreviewTtlSeconds: number;
};

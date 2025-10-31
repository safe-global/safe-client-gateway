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

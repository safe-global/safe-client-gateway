import type { Address } from 'viem';

// Type for no-fee campaign configuration
export type NoFeeCampaignConfiguration = Record<
  number,
  {
    startsAtTimeStamp: number;
    endsAtTimeStamp: number;
    maxTxValueInUSD: number;
    safeTokenAddress: Address;
    relayRules: RelayRules;
  }
>;

export type RelayRule = {
  balance: number;
  limit: number;
};

export type RelayRules = Array<RelayRule>;

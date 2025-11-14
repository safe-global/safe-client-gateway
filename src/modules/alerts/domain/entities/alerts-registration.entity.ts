import type { Address } from 'viem';

export type AlertsRegistration = {
  address: Address;
  chainId: string;
  // {chainId}:{safeAddress}:{moduleAddress}
  displayName?: `${string}:${string}:${string}`;
};

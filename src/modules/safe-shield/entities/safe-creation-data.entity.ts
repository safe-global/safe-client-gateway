import type { Address, Hex } from 'viem';

/**
 * Represents the data required for Safe creation analysis.
 * Contains factory address, master copy, and Safe account configuration.
 */
export type SafeCreationData = {
  factoryAddress: Address;
  masterCopy: Address;
  safeAccountConfig: {
    owners: Array<Address>;
    threshold: number;
    to: Address;
    data: Hex;
    fallbackHandler: Address;
    paymentToken: Address;
    payment: number;
    paymentReceiver: Address;
  };
  safeVersion: string | undefined;
};

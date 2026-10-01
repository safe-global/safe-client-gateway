// SPDX-License-Identifier: FSL-1.1-MIT
/** What a relayed calldata does, which determines who may pay for it. */
export const RelayCall = {
  SIGNER_CREATION: 'SIGNER_CREATION',
  SAFE_CREATION: 'SAFE_CREATION',
  REFUNDING_TRANSACTION: 'REFUNDING_TRANSACTION',
  TRANSACTION: 'TRANSACTION',
} as const;

export type RelayCall = (typeof RelayCall)[keyof typeof RelayCall];

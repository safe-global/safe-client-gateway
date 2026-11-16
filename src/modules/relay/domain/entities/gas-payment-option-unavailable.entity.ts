// SPDX-License-Identifier: FSL-1.1-MIT
export const GAS_PAYMENT_OPTION_UNAVAILABLE_CODE =
  'GAS_PAYMENT_OPTION_UNAVAILABLE';

/** Why the requested gas payment option can't pay for the request. */
export const GAS_PAYMENT_OPTION_UNAVAILABLE_REASONS = [
  'NOT_LISTED',
  'NO_RELAYER',
  'NOT_A_WORKSPACE_SAFE',
  'REFUNDING_TRANSACTION',
] as const;

export type GasPaymentOptionUnavailableReason =
  (typeof GAS_PAYMENT_OPTION_UNAVAILABLE_REASONS)[number];

// SPDX-License-Identifier: FSL-1.1-MIT
/** Who pays for a relayed transaction; a chain lists the ones it offers. */
export const GasPaymentOption = {
  FREE_DAILY_LIMIT: 'FREE_DAILY_LIMIT',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PAY_FROM_SAFE: 'PAY_FROM_SAFE',
  NO_FEE_CAMPAIGN: 'NO_FEE_CAMPAIGN',
} as const;

export type GasPaymentOption =
  (typeof GasPaymentOption)[keyof typeof GasPaymentOption];

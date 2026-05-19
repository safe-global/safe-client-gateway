// SPDX-License-Identifier: FSL-1.1-MIT
export const RelayerType = {
  GTF: 'GTF',
  RELAY_FEE: 'RELAY_FEE',
  DAILY_LIMIT: 'DAILY_LIMIT',
  NO_FEE_CAMPAIGN: 'NO_FEE_CAMPAIGN',
} as const;

export type RelayerType = (typeof RelayerType)[keyof typeof RelayerType];

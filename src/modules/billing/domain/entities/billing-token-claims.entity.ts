// SPDX-License-Identifier: FSL-1.1-MIT

export type BillingTokenClaims = {
  issuer: string;
  expiresInDays: number;
  subject?: string;
  /** Injectable clock for deterministic tests. */
  now?: Date;
};

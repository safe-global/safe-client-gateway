// SPDX-License-Identifier: FSL-1.1-MIT

/** A plan was picked, but this deployment runs without the billing service. */
export class BillingUnavailableError extends Error {
  public constructor() {
    super('Billing is not available');
  }
}

// SPDX-License-Identifier: FSL-1.1-MIT

/** Billing is enforced, so a new Workspace starts with a plan. */
export class PlanRequiredError extends Error {
  public constructor() {
    super('A plan is required to start the trial');
  }
}

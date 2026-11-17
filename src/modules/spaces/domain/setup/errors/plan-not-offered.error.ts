// SPDX-License-Identifier: FSL-1.1-MIT

/** The picked payment link is not among the ones this Workspace is offered. */
export class PlanNotOfferedError extends Error {
  public constructor() {
    super('This plan is not available for this workspace');
  }
}

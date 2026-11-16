// SPDX-License-Identifier: FSL-1.1-MIT

/** The picked plan has fewer Safe seats than the setup's Safes take. */
export class NotEnoughSeatsError extends Error {
  public constructor() {
    super("This plan doesn't offer enough Safe seats for the selected Safes");
  }
}

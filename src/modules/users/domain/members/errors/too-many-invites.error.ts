// SPDX-License-Identifier: FSL-1.1-MIT

/** More invites in one request than `SPACES_MAX_INVITES` allows. */
export class TooManyInvitesError extends Error {
  public constructor() {
    super('Too many invites.');
  }
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { TooManyInvitesError } from '#/modules/users/domain/members/errors/too-many-invites.error';

/** Rejects a batch of invites larger than `maxInvites`. */
export function assertWithinInviteLimit(args: {
  inviteCount: number;
  maxInvites: number;
}): void {
  if (args.inviteCount > args.maxInvites) {
    throw new TooManyInvitesError();
  }
}

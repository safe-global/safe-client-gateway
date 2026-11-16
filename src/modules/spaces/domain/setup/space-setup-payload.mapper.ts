// SPDX-License-Identifier: FSL-1.1-MIT
import {
  SPACE_SETUP_PAYLOAD_VERSION,
  type SpaceSetupPayload,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { assertWithinInviteLimit } from '#/modules/users/domain/members/invite-limit.rules';

/**
 * The payload a setup stores, from the form's parts. The survey answer is
 * expected checked already, since that needs the active survey.
 *
 * @throws {TooManyInvitesError} when the form invites more than `maxInvites`.
 */
export function buildSetupPayload(args: {
  form: Omit<SpaceSetupPayload, 'version'>;
  maxInvites: number;
}): SpaceSetupPayload {
  assertWithinInviteLimit({
    inviteCount: args.form.invites.length,
    maxInvites: args.maxInvites,
  });
  return { version: SPACE_SETUP_PAYLOAD_VERSION, ...args.form };
}

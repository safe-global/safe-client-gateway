// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { spaceSetupPayloadBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import {
  SPACE_SETUP_PAYLOAD_VERSION,
  type SpaceSetupPayload,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { buildSetupPayload } from '#/modules/spaces/domain/setup/space-setup-payload.mapper';
import { walletInviteUserDtoBuilder } from '#/modules/spaces/routes/members/entities/__tests__/invite-user.dto.builder';
import { TooManyInvitesError } from '#/modules/users/domain/members/errors/too-many-invites.error';

describe('buildSetupPayload', () => {
  const maxInvites = faker.number.int({ min: 2, max: 10 });

  function inviteList(count: number): IBuilder<SpaceSetupPayload> {
    return spaceSetupPayloadBuilder().with(
      'invites',
      faker.helpers.multiple(() => walletInviteUserDtoBuilder().build(), {
        count,
      }),
    );
  }

  it('stamps the form with the current payload version', () => {
    const { version: _, ...form } = inviteList(maxInvites).build();

    expect(buildSetupPayload({ form, maxInvites })).toEqual({
      version: SPACE_SETUP_PAYLOAD_VERSION,
      ...form,
    });
  });

  it('refuses more invites than the limit', () => {
    const { version: _, ...form } = inviteList(maxInvites + 1).build();

    expect(() => buildSetupPayload({ form, maxInvites })).toThrow(
      TooManyInvitesError,
    );
  });
});

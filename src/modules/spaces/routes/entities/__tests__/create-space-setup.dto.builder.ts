// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { nameBuilder } from '#/domain/common/entities/name.builder';
import { spaceSetupPayloadBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import type { CreateSpaceSetupDto } from '#/modules/spaces/routes/entities/space-setup.dto.entity';

export function createSpaceSetupDtoBuilder(): IBuilder<CreateSpaceSetupDto> {
  const payload = spaceSetupPayloadBuilder().build();
  return new Builder<CreateSpaceSetupDto>()
    .with('name', nameBuilder())
    .with('paymentLinkId', faker.string.alphanumeric(16))
    .with('safes', payload.safes)
    .with('addressBookItems', payload.addressBookItems)
    .with('invites', payload.invites)
    .with('survey', payload.survey)
    .with('returnUrl', faker.internet.url());
}

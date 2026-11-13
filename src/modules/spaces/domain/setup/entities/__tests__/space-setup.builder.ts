// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { nameBuilder } from '#/domain/common/entities/name.builder';
import type { AddressBookItem } from '#/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type {
  SpaceSetup,
  SpaceSetupPayload,
  SpaceSetupSafe,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';

export function spaceSetupSafeBuilder(): IBuilder<SpaceSetupSafe> {
  return new Builder<SpaceSetupSafe>()
    .with('chainId', faker.string.numeric({ length: { min: 1, max: 6 } }))
    .with('address', getAddress(faker.finance.ethereumAddress()));
}

/** A contact naming `safe` on its chain. */
export function contactFor(safe: SpaceSetupSafe): AddressBookItem {
  return {
    name: nameBuilder(),
    address: safe.address,
    chainIds: [safe.chainId],
  };
}

export function spaceSetupPayloadBuilder(): IBuilder<SpaceSetupPayload> {
  const safes = faker.helpers.multiple(() => spaceSetupSafeBuilder().build(), {
    count: { min: 1, max: 3 },
  });
  return new Builder<SpaceSetupPayload>()
    .with('version', 1)
    .with('safes', safes)
    .with('addressBookItems', safes.map(contactFor))
    .with('invites', [])
    .with('survey', null);
}

export function spaceSetupBuilder(): IBuilder<SpaceSetup> {
  return new Builder<SpaceSetup>()
    .with('id', faker.number.int({ min: 1, max: 1_000_000 }))
    .with('spaceId', faker.number.int({ min: 1, max: 1_000_000 }))
    .with('paymentLinkId', faker.string.alphanumeric(16))
    .with('payload', spaceSetupPayloadBuilder().build())
    .with('status', 'PENDING')
    .with('claimId', null)
    .with('appliedAt', null)
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent());
}

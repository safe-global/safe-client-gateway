// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import type { Relay } from '#/modules/relay/domain/entities/relay.entity';

export function relayBuilder(): IBuilder<Relay> {
  return new Builder<Relay>().with(
    'taskId',
    faker.string.alphanumeric({ length: 73 }),
  );
}

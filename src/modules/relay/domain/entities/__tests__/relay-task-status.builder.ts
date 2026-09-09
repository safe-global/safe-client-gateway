// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { RelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';

export function relayTaskStatusBuilder(): IBuilder<RelayTaskStatus> {
  return new Builder<RelayTaskStatus>()
    .with('chainId', faker.string.numeric())
    .with('id', faker.string.alphanumeric({ length: 73 }))
    .with('status', faker.number.int({ min: 100, max: 599 }))
    .with('receipt', {
      transactionHash: faker.string.hexadecimal({ length: 64 }),
    });
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, toHex } from 'viem';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { SignatureType } from '#/domain/common/entities/signature-type.entity';
import type { SafeQueueConfirmation } from '#/modules/safe-queue/entities/multisig-transaction.entity';

const SIGNATURE_BYTES = 65;

export function safeQueueConfirmationBuilder(): IBuilder<SafeQueueConfirmation> {
  return new Builder<SafeQueueConfirmation>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('signature', toHex(faker.string.alphanumeric(SIGNATURE_BYTES)))
    .with('signatureType', faker.helpers.enumValue(SignatureType))
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent());
}

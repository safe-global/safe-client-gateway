// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hash, type Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/routes/entities/propose-transaction.dto.entity';

export function proposeTransactionDtoBuilder(): IBuilder<ProposeTransactionDto> {
  return new Builder<ProposeTransactionDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', faker.string.hexadecimal({ length: 32 }) as Hex)
    .with('nonce', faker.string.numeric())
    .with('operation', faker.helpers.arrayElement([0, 1]) as Operation)
    .with('safeTxGas', faker.string.numeric())
    .with('baseGas', faker.string.numeric())
    .with('gasPrice', faker.string.numeric())
    .with('gasToken', getAddress(faker.finance.ethereumAddress()))
    .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
    .with('safeTxHash', faker.string.hexadecimal({ length: 32 }) as Hash)
    .with('sender', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 130 }) as Hex)
    .with('origin', faker.word.sample());
}

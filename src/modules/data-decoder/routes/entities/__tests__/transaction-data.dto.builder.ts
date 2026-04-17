// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';

export function transactionDataDtoBuilder(): IBuilder<TransactionDataDto> {
  return new Builder<TransactionDataDto>()
    .with('data', faker.string.hexadecimal() as Hex)
    .with('to', getAddress(faker.finance.ethereumAddress()));
}

import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import { getAddress, type Hex } from 'viem';

export function transactionDataDtoBuilder(): IBuilder<TransactionDataDto> {
  return new Builder<TransactionDataDto>()
    .with('data', faker.string.hexadecimal() as Hex)
    .with('to', getAddress(faker.finance.ethereumAddress()));
}

import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import { getAddress } from 'viem';

export function transactionDataDtoBuilder(): IBuilder<TransactionDataDto> {
  return new Builder<TransactionDataDto>()
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('to', getAddress(faker.finance.ethereumAddress()));
}

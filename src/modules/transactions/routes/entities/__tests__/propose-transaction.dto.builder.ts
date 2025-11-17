import { faker } from '@faker-js/faker';
import type { Operation } from '@/domain/safe/entities/operation.entity';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ProposeTransactionDto } from '@/modules/transactions/routes/entities/propose-transaction.dto.entity';
import { type Hash, type Hex, getAddress } from 'viem';

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

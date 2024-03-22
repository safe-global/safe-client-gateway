import { faker } from '@faker-js/faker';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { Builder, IBuilder } from '@/__tests__/builder';
import { ProposeTransactionDto } from '@/routes/transactions/entities/propose-transaction.dto.entity';
import { getAddress } from 'viem';

export function proposeTransactionDtoBuilder(): IBuilder<ProposeTransactionDto> {
  return new Builder<ProposeTransactionDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
    .with('nonce', faker.string.numeric())
    .with('operation', faker.helpers.arrayElement([0, 1]) as Operation)
    .with('safeTxGas', faker.string.numeric())
    .with('baseGas', faker.string.numeric())
    .with('gasPrice', faker.string.numeric())
    .with('gasToken', getAddress(faker.finance.ethereumAddress()))
    .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
    .with(
      'safeTxHash',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    )
    .with('sender', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    )
    .with('origin', faker.word.sample());
}

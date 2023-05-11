import { faker } from '@faker-js/faker';
import { Operation } from '../../../../domain/safe/entities/operation.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { ProposeTransactionDto } from '../propose-transaction.dto.entity';

export function proposeTransactionDtoBuilder(): IBuilder<ProposeTransactionDto> {
  return Builder.new<ProposeTransactionDto>()
    .with('to', faker.finance.ethereumAddress())
    .with('value', faker.random.numeric())
    .with('data', faker.datatype.hexadecimal(32))
    .with('nonce', faker.random.numeric())
    .with('operation', faker.helpers.arrayElement([0, 1]) as Operation)
    .with('safeTxGas', faker.random.numeric())
    .with('baseGas', faker.random.numeric())
    .with('gasPrice', faker.random.numeric())
    .with('gasToken', faker.datatype.hexadecimal(32))
    .with('refundReceiver', faker.finance.ethereumAddress())
    .with('safeTxHash', faker.datatype.hexadecimal(32))
    .with('sender', faker.finance.ethereumAddress())
    .with('signature', faker.datatype.hexadecimal(32))
    .with('origin', faker.random.word());
}

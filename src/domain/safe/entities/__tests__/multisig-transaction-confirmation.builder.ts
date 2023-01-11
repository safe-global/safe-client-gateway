import { Confirmation } from '../multisig-transaction.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function confirmationBuilder(): IBuilder<Confirmation> {
  return Builder.new<Confirmation>()
    .with('owner', faker.finance.ethereumAddress())
    .with('signature', faker.datatype.hexadecimal())
    .with('signatureType', faker.datatype.string())
    .with('submissionDate', faker.date.recent())
    .with('transactionHash', faker.datatype.hexadecimal());
}

export function toJson(confirmation: Confirmation): unknown {
  return {
    ...confirmation,
    submissionDate: confirmation.submissionDate.toISOString(),
  };
}

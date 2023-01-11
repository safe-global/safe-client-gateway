import { MultisigTransaction } from '../multisig-transaction.entity';
import { Operation } from '../operation.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import {
  confirmationBuilder,
  toJson as confirmationToJson,
} from './multisig-transaction-confirmation.builder';

export function multisigTransactionBuilder(): IBuilder<MultisigTransaction> {
  return Builder.new<MultisigTransaction>()
    .with('baseGas', faker.datatype.number())
    .with('blockNumber', faker.datatype.number())
    .with('confirmations', [confirmationBuilder().build()])
    .with('confirmationsRequired', faker.datatype.number())
    .with('data', faker.datatype.hexadecimal())
    .with('dataDecoded', faker.datatype.json())
    .with('ethGasPrice', faker.datatype.hexadecimal())
    .with('executor', faker.finance.ethereumAddress())
    .with('executionDate', faker.date.recent())
    .with('fee', faker.datatype.hexadecimal())
    .with('gasPrice', faker.datatype.hexadecimal())
    .with('gasToken', faker.finance.ethereumAddress())
    .with('gasUsed', faker.datatype.number())
    .with('isExecuted', faker.datatype.boolean())
    .with('isSuccessful', faker.datatype.boolean())
    .with('modified', faker.date.recent())
    .with('nonce', faker.datatype.number())
    .with('operation', faker.helpers.arrayElement([0, 1]) as Operation)
    .with('origin', faker.internet.url())
    .with('refundReceiver', faker.finance.ethereumAddress())
    .with('safe', faker.finance.ethereumAddress())
    .with('safeTxGas', faker.datatype.number())
    .with('safeTxHash', faker.datatype.hexadecimal())
    .with('signatures', faker.datatype.hexadecimal())
    .with('submissionDate', faker.date.recent())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.datatype.hexadecimal())
    .with('value', faker.datatype.hexadecimal());
}

export function toJson(multisigTransaction: MultisigTransaction): unknown {
  return {
    ...multisigTransaction,
    confirmations: multisigTransaction.confirmations?.map((confirmation) =>
      confirmationToJson(confirmation),
    ),
    executionDate: multisigTransaction.executionDate.toISOString(),
    modified: multisigTransaction.modified?.toISOString(),
    submissionDate: multisigTransaction.submissionDate?.toISOString(),
  };
}

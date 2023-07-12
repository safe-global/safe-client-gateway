import { faker } from '@faker-js/faker';
import { random, range } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { MultisigTransaction } from '../multisig-transaction.entity';
import { Operation } from '../operation.entity';
import {
  confirmationBuilder,
  toJson as confirmationToJson,
} from './multisig-transaction-confirmation.builder';
import { dataDecodedBuilder } from '../../../data-decoder/entities/__tests__/data-decoded.builder';

const HASH_LENGTH = 10;

export function multisigTransactionBuilder(): IBuilder<MultisigTransaction> {
  return Builder.new<MultisigTransaction>()
    .with('baseGas', faker.number.int())
    .with('blockNumber', faker.number.int())
    .with(
      'confirmations',
      range(random(5)).map(() => confirmationBuilder().build()),
    )
    .with('confirmationsRequired', faker.number.int())
    .with('data', faker.string.hexadecimal())
    .with('dataDecoded', dataDecodedBuilder().build())
    .with('ethGasPrice', faker.string.hexadecimal())
    .with('executor', faker.finance.ethereumAddress())
    .with('executionDate', faker.date.recent())
    .with('fee', faker.string.hexadecimal())
    .with('gasPrice', faker.string.hexadecimal())
    .with('gasToken', faker.finance.ethereumAddress())
    .with('gasUsed', faker.number.int())
    .with('isExecuted', faker.datatype.boolean())
    .with('isSuccessful', faker.datatype.boolean())
    .with('modified', faker.date.recent())
    .with('nonce', faker.number.int())
    .with('operation', faker.helpers.arrayElement([0, 1]) as Operation)
    .with(
      'origin',
      `{"url": "${faker.internet.url({
        appendSlash: false,
      })}", "name": "${faker.word.words()}"}`,
    )
    .with('refundReceiver', faker.finance.ethereumAddress())
    .with('safe', faker.finance.ethereumAddress())
    .with('safeTxGas', faker.number.int())
    .with('safeTxHash', faker.string.hexadecimal({ length: HASH_LENGTH }))
    .with('signatures', faker.string.hexadecimal())
    .with('submissionDate', faker.date.recent())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal({ length: HASH_LENGTH }))
    .with('trusted', faker.datatype.boolean())
    .with('value', faker.string.hexadecimal());
}

export function toJson(multisigTransaction: MultisigTransaction): unknown {
  return {
    ...multisigTransaction,
    confirmations: multisigTransaction.confirmations?.map((confirmation) =>
      confirmationToJson(confirmation),
    ),
    txType: 'MULTISIG_TRANSACTION',
    executionDate: multisigTransaction.executionDate?.toISOString(),
    modified: multisigTransaction.modified?.toISOString(),
    submissionDate: multisigTransaction.submissionDate.toISOString(),
  };
}

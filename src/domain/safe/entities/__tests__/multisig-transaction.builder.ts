import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/v1/entities/__tests__/data-decoded.builder';
import {
  confirmationBuilder,
  toJson as confirmationToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { Operation } from '@/domain/safe/entities/operation.entity';
import { getAddress } from 'viem';

const HASH_LENGTH = 10;

export async function multisigTransactionBuilder(): Promise<
  IBuilder<MultisigTransaction>
> {
  const safeTxHash = faker.string.hexadecimal({
    length: 64,
  }) as `0x${string}`;

  const confirmations = await Promise.all(
    Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, async () => {
      return (await confirmationBuilder(safeTxHash)).build();
    }),
  );

  return (
    new Builder<MultisigTransaction>()
      .with('baseGas', faker.number.int())
      .with('blockNumber', faker.number.int())
      .with('confirmations', confirmations)
      .with('confirmationsRequired', faker.number.int())
      .with('data', faker.string.hexadecimal() as `0x${string}`)
      .with('dataDecoded', dataDecodedBuilder().build())
      .with('ethGasPrice', faker.string.numeric())
      .with('executor', getAddress(faker.finance.ethereumAddress()))
      .with('executionDate', faker.date.recent())
      .with('fee', faker.string.numeric())
      .with('gasPrice', faker.string.numeric())
      .with('gasToken', getAddress(faker.finance.ethereumAddress()))
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
      .with('proposer', getAddress(faker.finance.ethereumAddress()))
      // Not proposed by delegate
      .with('proposedByDelegate', null)
      .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
      .with('safe', getAddress(faker.finance.ethereumAddress()))
      .with('safeTxGas', faker.number.int())
      .with('safeTxHash', safeTxHash)
      .with('signatures', faker.string.hexadecimal() as `0x${string}`)
      .with('submissionDate', faker.date.recent())
      .with('to', getAddress(faker.finance.ethereumAddress()))
      .with(
        'transactionHash',
        faker.string.hexadecimal({ length: HASH_LENGTH }) as `0x${string}`,
      )
      .with('trusted', faker.datatype.boolean())
      .with('value', faker.string.numeric())
  );
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

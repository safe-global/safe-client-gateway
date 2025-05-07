import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import {
  confirmationBuilder,
  toJson as confirmationToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import type {
  Confirmation,
  MultisigTransaction,
} from '@/domain/safe/entities/multisig-transaction.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';
import type { Operation } from '@/domain/safe/entities/operation.entity';
import { getAddress, type PrivateKeyAccount } from 'viem';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';

const HASH_LENGTH = 32;

// TODO: Refactor with multisig BuilderWithConfirmations
class BuilderWithConfirmations<
  T extends MultisigTransaction,
> extends Builder<T> {
  public async buildWithConfirmations(args: {
    chainId: string;
    safe: Safe;
    signers: Array<PrivateKeyAccount>;
    signatureType?: SignatureType;
  }): Promise<T> {
    const areAllOwners = args.signers.every((signer) => {
      return args.safe.owners.includes(signer.address);
    });

    if (!areAllOwners) {
      throw new Error('All signers must be owners of the Safe');
    }

    const transaction = this.build();

    if (args.safe.address !== transaction.safe) {
      throw new Error('Safe address does not match');
    }

    transaction.safeTxHash = getSafeTxHash({
      ...args,
      transaction,
    });

    transaction.confirmations = await Promise.all(
      args.signers.map(async (signer): Promise<Confirmation> => {
        const signatureType =
          args.signatureType ?? faker.helpers.enumValue(SignatureType);
        const signature = await getSignature({
          signer,
          hash: transaction.safeTxHash,
          signatureType,
        });

        return {
          owner: signer.address,
          signature,
          signatureType,
          submissionDate: faker.date.recent(),
          transactionHash: null,
        };
      }),
    );

    return transaction;
  }
}

export function multisigTransactionBuilder(): BuilderWithConfirmations<MultisigTransaction> {
  // confirmations and safeTxHash explicitly not set
  return (
    new BuilderWithConfirmations<MultisigTransaction>()
      .with('baseGas', faker.number.int())
      .with('blockNumber', faker.number.int())
      .with('confirmationsRequired', faker.number.int())
      .with('data', faker.string.hexadecimal() as `0x${string}`)
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
      .with('signatures', faker.string.hexadecimal() as `0x${string}`)
      .with('submissionDate', faker.date.recent())
      .with('to', getAddress(faker.finance.ethereumAddress()))
      .with(
        'transactionHash',
        faker.string.hexadecimal({ length: HASH_LENGTH }) as `0x${string}`,
      )
      .with('trusted', faker.datatype.boolean())
      .with('value', faker.string.numeric())
      // Generated in buildWithConfirmations
      .with(
        'confirmations',
        faker.helpers.multiple(() => confirmationBuilder().build(), {
          count: { min: 0, max: 5 },
        }),
      )
      .with(
        'safeTxHash',
        faker.string.hexadecimal({ length: HASH_LENGTH }) as `0x${string}`,
      )
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

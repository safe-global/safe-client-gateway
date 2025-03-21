import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Confirmation } from '@/domain/safe/entities/multisig-transaction.entity';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getAddress } from 'viem';

const HASH_LENGTH = 64;
const SIGNATURE_LENGTH = 130;

export function confirmationBuilder(): IBuilder<Confirmation> {
  const signatureType = faker.helpers.enumValue(SignatureType);
  return new Builder<Confirmation>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: SIGNATURE_LENGTH }) as `0x${string}`,
    )
    .with('signatureType', signatureType)
    .with('submissionDate', faker.date.recent())
    .with(
      'transactionHash',
      [SignatureType.Eoa, SignatureType.EthSign].includes(signatureType)
        ? (faker.string.hexadecimal({ length: HASH_LENGTH }) as `0x${string}`)
        : null,
    );
}

export function toJson(confirmation: Confirmation): unknown {
  return {
    ...confirmation,
    submissionDate: confirmation.submissionDate.toISOString(),
  };
}

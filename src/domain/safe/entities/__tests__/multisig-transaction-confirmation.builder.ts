import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Confirmation } from '@/domain/safe/entities/multisig-transaction.entity';
import { getAddress } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';

export function confirmationBuilder(): IBuilder<Confirmation> {
  return new Builder<Confirmation>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal() as `0x${string}`)
    .with('signatureType', faker.helpers.objectValue(SignatureType))
    .with('submissionDate', faker.date.recent())
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`);
}

export function toJson(confirmation: Confirmation): unknown {
  return {
    ...confirmation,
    submissionDate: confirmation.submissionDate.toISOString(),
  };
}

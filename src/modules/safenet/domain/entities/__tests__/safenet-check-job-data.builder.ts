// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '#/__tests__/builder';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import type { SafenetCheckJobData } from '#/modules/safenet/domain/entities/safenet-check-job-data.entity';

export function safenetCheckJobDataBuilder(): IBuilder<SafenetCheckJobData> {
  const transaction = multisigTransactionBuilder().build();
  return new Builder<SafenetCheckJobData>()
    .with('chainId', faker.string.numeric({ exclude: ['0'] }))
    .with('safe', transaction.safe)
    .with('safeTxHash', transaction.safeTxHash)
    .with('transaction', getBaseMultisigTransaction(transaction));
}

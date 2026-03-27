// SPDX-License-Identifier: FSL-1.1-MIT
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  toJson as multisigToJson,
  multisigTransactionBuilder,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export async function buildSafeWithTransaction(args: {
  nonce: number;
  submissionDate: Date;
}): Promise<{
  chain: ReturnType<typeof chainBuilder>['build'] extends () => infer R
    ? R
    : never;
  safeAddress: string;
  safe: ReturnType<typeof safeBuilder>['build'] extends () => infer R
    ? R
    : never;
  transaction: MultisigTransaction;
}> {
  const chain = chainBuilder().build();
  const signers = Array.from({ length: 2 }, () =>
    privateKeyToAccount(generatePrivateKey()),
  );
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const safe = safeBuilder()
    .with('address', safeAddress)
    .with('nonce', args.nonce)
    .with(
      'owners',
      signers.map((s) => s.address),
    )
    .build();
  const tx = await multisigTransactionBuilder()
    .with('safe', safeAddress)
    .with('isExecuted', false)
    .with('nonce', args.nonce)
    .with('submissionDate', args.submissionDate)
    .with('modified', args.submissionDate)
    .buildWithConfirmations({
      safe,
      chainId: chain.chainId,
      signers: [signers[0]],
    });
  return { chain, safeAddress, safe, transaction: tx };
}

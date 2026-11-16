// SPDX-License-Identifier: FSL-1.1-MIT
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';

/** A multisig transaction together with the chain of its Safe. */
export type ChainMultisigTransaction = {
  chainId: string;
  transaction: MultisigTransaction;
};

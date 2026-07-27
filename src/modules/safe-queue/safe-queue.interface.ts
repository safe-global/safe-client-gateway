// SPDX-License-Identifier: FSL-1.1-MIT

import type { Address, Hex } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { SafeQueueMessage } from '@/modules/safe-queue/entities/message.entity';
import type { SafeQueueMultisigTransactionEntity } from '@/modules/safe-queue/entities/multisig-transaction.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const ISafeQueueService = Symbol('ISafeQueueService');

export interface ISafeQueueService {
  proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<Raw<SafeQueueMultisigTransactionEntity>>;

  getMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<Raw<SafeQueueMultisigTransactionEntity>>;

  getMultisigTransactionsBatch(args: {
    chainId: string;
    safeTxHashes: ReadonlyArray<string>;
  }): Promise<Raw<Array<SafeQueueMultisigTransactionEntity>>>;

  getTransactionQueue(args: {
    chainId: string;
    safeAddress: Address;
    // The queue service can only order the queue by nonce. Callers translate
    // their desired tx-service ordering into a nonce direction explicitly.
    nonceOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<SafeQueueMultisigTransactionEntity>>>;

  postConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<Raw<SafeQueueMultisigTransactionEntity>>;

  deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>>;

  postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  updateDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown>;

  getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Raw<SafeQueueMessage>>;

  getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<SafeQueueMessage>>>;

  postMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: unknown;
    signature: string;
    origin: string | null;
  }): Promise<unknown>;

  postMessageSignature(args: {
    chainId: string;
    messageHash: string;
    signature: Hex;
  }): Promise<unknown>;

  // Cache clearing
  clearMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<void>;

  clearAllTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void>;

  clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void>;
}

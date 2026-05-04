// SPDX-License-Identifier: FSL-1.1-MIT
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { QueueMessage } from '@/modules/queue/entities/message.entity';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address, Hex } from 'viem';

export const IQueue = Symbol('IQueue');

export interface IQueue {
  proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown>;

  getMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<Raw<QueueMultisigTransactionEntity>>;

  getMultisigTransactionsBatch(args: {
    chainId: string;
    safeTxHashes: ReadonlyArray<string>;
  }): Promise<Raw<Array<QueueMultisigTransactionEntity>>>;

  getTransactionQueue(args: {
    chainId: string;
    safeAddress: Address;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<QueueMultisigTransactionEntity>>>;

  postConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<unknown>;

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
  }): Promise<Raw<QueueMessage>>;

  getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<QueueMessage>>>;

  postMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: unknown;
    safeAppId: number | null;
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

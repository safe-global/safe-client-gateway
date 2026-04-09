// SPDX-License-Identifier: FSL-1.1-MIT
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export const IQueueServiceApi = Symbol('IQueueServiceApi');

export interface QueueProposeTransactionDto {
  to: Address;
  value: number;
  data: string | null;
  nonce: number;
  operation: number;
  safeTxGas: number;
  baseGas: number;
  gasPrice: number;
  gasToken: Address | null;
  refundReceiver: Address | null;
  safeTxHash: string;
  proposer: Address;
  signature: string;
  originName?: string;
  originUrl?: string;
}

export interface IQueueServiceApi {
  proposeTransaction(args: {
    chainId: string;
    safe: Address;
    data: QueueProposeTransactionDto;
  }): Promise<unknown>;

  getMultisigTransaction(safeTxHash: string): Promise<Raw<MultisigTransaction>>;

  getTransactionQueue(args: {
    safes: Array<string>;
    nonceOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>>;

  getMultisigTransactions(args: {
    safes: Array<string>;
    executed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>>;

  postConfirmation(args: {
    safeTxHash: string;
    signatures: Array<string>;
  }): Promise<unknown>;

  deleteTransaction(args: {
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  getDelegates(args: {
    chainId?: number;
    safe?: Address;
    delegate?: Address;
    delegator?: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>>;

  postDelegate(args: {
    delegate: Address;
    delegator: Address;
    signature: string;
    chainId?: number;
    safe?: Address;
    label?: string;
  }): Promise<void>;

  deleteDelegate(args: {
    delegate: Address;
    delegator: Address;
    signature: string;
    chainId?: number;
    safe?: Address;
  }): Promise<void>;

  getMessageByHash(messageHash: string): Promise<Raw<Message>>;

  getMessagesBySafe(args: {
    safeAddress: Address;
    chainId?: number;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Message>>>;

  postMessage(args: {
    safeAddress: Address;
    chainId: number;
    message: unknown;
    signatures: Array<string>;
    originName?: string;
    originUrl?: string;
  }): Promise<Raw<Message>>;

  postMessageSignature(args: {
    messageHash: string;
    signatures: Array<string>;
  }): Promise<unknown>;
}

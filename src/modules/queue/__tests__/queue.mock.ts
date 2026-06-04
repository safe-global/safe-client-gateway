// SPDX-License-Identifier: FSL-1.1-MIT
import type { IQueue } from '@/modules/queue/queue.interface';

export function createMockQueueService(): jest.MockedObjectDeep<IQueue> {
  return {
    getMultisigTransaction: jest.fn(),
    getMultisigTransactionsBatch: jest.fn(),
    getTransactionQueue: jest.fn(),
    proposeTransaction: jest.fn(),
    postConfirmation: jest.fn(),
    deleteTransaction: jest.fn(),
    getDelegates: jest.fn(),
    postDelegate: jest.fn(),
    deleteDelegate: jest.fn(),
    getMessageByHash: jest.fn(),
    getMessagesBySafe: jest.fn(),
    postMessage: jest.fn(),
    postMessageSignature: jest.fn(),
    clearMultisigTransaction: jest.fn(),
    clearAllTransactions: jest.fn(),
    clearMessagesBySafe: jest.fn(),
    clearMessagesByHash: jest.fn(),
    clearDelegates: jest.fn(),
  } as jest.MockedObjectDeep<IQueue>;
}

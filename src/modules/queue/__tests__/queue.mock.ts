// SPDX-License-Identifier: FSL-1.1-MIT
import type { IQueue } from '@/modules/queue/queue.interface';
import type { MockedObject } from 'vitest';

export function createMockQueueService(): MockedObject<IQueue> {
  return {
    getMultisigTransaction: vi.fn(),
    getMultisigTransactionsBatch: vi.fn(),
    getTransactionQueue: vi.fn(),
    proposeTransaction: vi.fn(),
    postConfirmation: vi.fn(),
    deleteTransaction: vi.fn(),
    getDelegates: vi.fn(),
    postDelegate: vi.fn(),
    deleteDelegate: vi.fn(),
    getMessageByHash: vi.fn(),
    getMessagesBySafe: vi.fn(),
    postMessage: vi.fn(),
    postMessageSignature: vi.fn(),
    clearMultisigTransaction: vi.fn(),
    clearAllTransactions: vi.fn(),
    clearMessagesBySafe: vi.fn(),
    clearMessagesByHash: vi.fn(),
    clearDelegates: vi.fn(),
  } as MockedObject<IQueue>;
}

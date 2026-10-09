// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { MockedObject } from '#/__tests__/mocks';
import type { ISafeQueueService } from '#/modules/safe-queue/safe-queue.interface';

export function createMockSafeQueueService(): MockedObject<ISafeQueueService> {
  return {
    getMultisigTransaction: jest.fn(),
    getMultisigTransactionWithNoCache: jest.fn(),
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
  } as MockedObject<ISafeQueueService>;
}

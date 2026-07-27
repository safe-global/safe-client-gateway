// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hash, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { messageBuilder } from '@/modules/messages/domain/entities/__tests__/message.builder';
import { messageConfirmationBuilder } from '@/modules/messages/domain/entities/__tests__/message-confirmation.builder';
import type { MessageVerifierHelper } from '@/modules/messages/domain/helpers/message-verifier.helper';
import { MessagesRepository } from '@/modules/messages/domain/messages.repository';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { createMockSafeQueueService } from '@/modules/safe-queue/__tests__/safe-queue-service.mock';
import type { SafeQueueMessage } from '@/modules/safe-queue/entities/message.entity';
import type { ISafeQueueService } from '@/modules/safe-queue/safe-queue.interface';
import { rawify } from '@/validation/entities/raw.entity';

function safeQueueMessageBuilder(chainId: number): SafeQueueMessage {
  return {
    messageHash: faker.string.hexadecimal({ length: 64 }) as Hash,
    chainId,
    safe: getAddress(faker.finance.ethereumAddress()),
    message: faker.word.words({ count: { min: 1, max: 5 } }),
    proposedBy: getAddress(faker.finance.ethereumAddress()),
    preparedSignature: faker.string.hexadecimal({ length: 130 }) as Hash,
    originName: faker.word.words(),
    originUrl: faker.internet.url({ protocol: 'https', appendSlash: false }),
    created: faker.date.past(),
    modified: faker.date.recent(),
    confirmations: faker.helpers.multiple(
      () => messageConfirmationBuilder().build(),
      { count: { min: 1, max: 3 } },
    ),
  };
}

const mockTransactionApiManager = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

const mockTransactionApi = {
  getMessageByHash: vi.fn(),
  postMessage: vi.fn(),
  postMessageSignature: vi.fn(),
  clearMessagesBySafe: vi.fn(),
  clearMessagesByHash: vi.fn(),
} as MockedObject<ITransactionApi>;

const mockSafeRepository = {
  getSafe: vi.fn(),
} as MockedObject<ISafeRepository>;

const mockConfigurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const mockLoggingService = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const mockMessageVerifier = {
  verifyCreation: vi.fn(),
  verifyUpdate: vi.fn(),
} as MockedObject<MessageVerifierHelper>;

describe('MessagesRepository (queue service enabled)', () => {
  let safeQueueService: MockedObject<ISafeQueueService>;
  let target: MessagesRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'features.safeQueueService') return true;
      throw new Error(`Unexpected key: ${key}`);
    });
    safeQueueService = createMockSafeQueueService();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    mockTransactionApi.clearMessagesBySafe.mockResolvedValue(undefined);
    mockTransactionApi.clearMessagesByHash.mockResolvedValue(undefined);
    safeQueueService.clearMessagesBySafe.mockResolvedValue(undefined);
    safeQueueService.clearMessagesByHash.mockResolvedValue(undefined);
    target = new MessagesRepository(
      mockTransactionApiManager,
      mockSafeRepository,
      safeQueueService,
      mockConfigurationService,
      mockLoggingService,
      mockMessageVerifier,
    );
  });

  describe('getMessagesBySafe cross-chain filtering', () => {
    it('drops rows whose chainId differs from the request and adjusts count', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const otherChainId = chainId + 1;
      const matching = [
        safeQueueMessageBuilder(chainId),
        safeQueueMessageBuilder(chainId),
      ];
      const wrongChain = [safeQueueMessageBuilder(otherChainId)];
      const rawCount = matching.length + wrongChain.length;
      const page = pageBuilder()
        .with('count', rawCount)
        .with('results', [...matching, ...wrongChain])
        .build();
      safeQueueService.getMessagesBySafe.mockResolvedValue(rawify(page));

      const result = await target.getMessagesBySafe({
        chainId: String(chainId),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result.results).toHaveLength(matching.length);
      expect(result.results.map((m) => m.messageHash)).toEqual(
        matching.map((m) => m.messageHash),
      );
      // count is decremented by the number of dropped rows
      expect(result.count).toBe(rawCount - wrongChain.length);
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(wrongChain.length);
    });

    it('does not let an adjusted count fall below zero', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const otherChainId = chainId + 1;
      const wrongChain = [
        safeQueueMessageBuilder(otherChainId),
        safeQueueMessageBuilder(otherChainId),
      ];
      // count under-reports relative to dropped rows on this page
      const page = pageBuilder()
        .with('count', 1)
        .with('results', wrongChain)
        .build();
      safeQueueService.getMessagesBySafe.mockResolvedValue(rawify(page));

      const result = await target.getMessagesBySafe({
        chainId: String(chainId),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result.results).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('preserves a null count without coercing it to a number', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const page = pageBuilder()
        .with('count', null)
        .with('results', [
          safeQueueMessageBuilder(chainId),
          safeQueueMessageBuilder(chainId + 1),
        ])
        .build();
      safeQueueService.getMessagesBySafe.mockResolvedValue(rawify(page));

      const result = await target.getMessagesBySafe({
        chainId: String(chainId),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result.count).toBeNull();
      expect(result.results).toHaveLength(1);
    });

    it('keeps all rows and count when every row matches the chain', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const matching = faker.helpers.multiple(
        () => safeQueueMessageBuilder(chainId),
        { count: { min: 2, max: 4 } },
      );
      const page = pageBuilder()
        .with('count', matching.length)
        .with('results', matching)
        .build();
      safeQueueService.getMessagesBySafe.mockResolvedValue(rawify(page));

      const result = await target.getMessagesBySafe({
        chainId: String(chainId),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result.results).toHaveLength(matching.length);
      expect(result.count).toBe(matching.length);
      expect(mockLoggingService.warn).not.toHaveBeenCalled();
    });
  });

  describe('getMessageByHash cross-chain guard', () => {
    it('returns the message when the chainId matches', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const message = safeQueueMessageBuilder(chainId);
      safeQueueService.getMessageByHash.mockResolvedValue(rawify(message));

      const result = await target.getMessageByHash({
        chainId: String(chainId),
        messageHash: message.messageHash,
      });

      expect(result.messageHash).toBe(message.messageHash);
    });

    it('throws a not-found error when the chainId differs', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const message = safeQueueMessageBuilder(chainId + 1);
      safeQueueService.getMessageByHash.mockResolvedValue(rawify(message));

      await expect(
        target.getMessageByHash({
          chainId: String(chainId),
          messageHash: message.messageHash,
        }),
      ).rejects.toThrow(HttpExceptionNoLog);
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
    });
  });

  // Reconstructs the repository with the queue feature flag disabled — the flag
  // is read once in the constructor, so the fallback branch needs its own target.
  function buildTargetWithQueueDisabled(): MessagesRepository {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'features.safeQueueService') return false;
      throw new Error(`Unexpected key: ${key}`);
    });
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    return new MessagesRepository(
      mockTransactionApiManager,
      mockSafeRepository,
      safeQueueService,
      mockConfigurationService,
      mockLoggingService,
      mockMessageVerifier,
    );
  }

  function createMessageArgs(): {
    chainId: string;
    safeAddress: Address;
    message: string;
    signature: Hex;
    origin: string | null;
  } {
    return {
      chainId: String(faker.number.int({ min: 1, max: 1000 })),
      safeAddress: getAddress(faker.finance.ethereumAddress()),
      message: faker.word.words(),
      signature: faker.string.hexadecimal({ length: 130 }) as Hex,
      origin: faker.datatype.boolean()
        ? faker.internet.url({ protocol: 'https', appendSlash: false })
        : null,
    };
  }

  describe('createMessage write routing', () => {
    it('verifies creation then forwards to the queue service when enabled', async () => {
      const safe = safeBuilder().build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      const posted = rawify({ id: faker.string.uuid() });
      safeQueueService.postMessage.mockResolvedValue(posted);
      const args = createMessageArgs();

      const result = await target.createMessage(args);

      expect(mockSafeRepository.getSafe).toHaveBeenCalledWith({
        chainId: args.chainId,
        address: args.safeAddress,
      });
      expect(mockMessageVerifier.verifyCreation).toHaveBeenCalledWith({
        chainId: args.chainId,
        safe,
        message: args.message,
        signature: args.signature,
      });
      // Enabled path forwards the args verbatim — no safeAppId injected.
      expect(safeQueueService.postMessage).toHaveBeenCalledWith(args);
      expect(result).toBe(posted);

      await new Promise(setImmediate);
      expect(safeQueueService.clearMessagesBySafe).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
      expect(mockTransactionApi.clearMessagesBySafe).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
    });

    it('forwards to the transaction service with safeAppId null when disabled', async () => {
      const disabledTarget = buildTargetWithQueueDisabled();
      const safe = safeBuilder().build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      const posted = rawify({ id: faker.string.uuid() });
      mockTransactionApi.postMessage.mockResolvedValue(posted);
      const args = createMessageArgs();

      const result = await disabledTarget.createMessage(args);

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(
        args.chainId,
      );
      expect(mockTransactionApi.postMessage).toHaveBeenCalledWith({
        safeAddress: args.safeAddress,
        message: args.message,
        safeAppId: null,
        signature: args.signature,
        origin: args.origin,
      });
      expect(safeQueueService.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(posted);
    });
  });

  describe('updateMessageSignature write routing', () => {
    it('forwards to the queue service when enabled', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const message = safeQueueMessageBuilder(chainId);
      safeQueueService.getMessageByHash.mockResolvedValue(rawify(message));
      mockSafeRepository.getSafe.mockResolvedValue(safeBuilder().build());
      const posted = rawify({ id: faker.string.uuid() });
      safeQueueService.postMessageSignature.mockResolvedValue(posted);
      const args = {
        chainId: String(chainId),
        messageHash: message.messageHash,
        signature: faker.string.hexadecimal({ length: 130 }) as Hex,
      };

      const result = await target.updateMessageSignature(args);

      // The message is fetched (and its safe resolved) before verification.
      expect(safeQueueService.getMessageByHash).toHaveBeenCalledWith({
        chainId: args.chainId,
        messageHash: args.messageHash,
      });
      expect(mockMessageVerifier.verifyUpdate).toHaveBeenCalled();
      expect(safeQueueService.postMessageSignature).toHaveBeenCalledWith(args);
      expect(result).toBe(posted);

      // fire-and-forget cache invalidation for both the message-by-hash and
      // the safe's messages caches
      await new Promise(setImmediate);
      expect(safeQueueService.clearMessagesByHash).toHaveBeenCalledWith({
        chainId: args.chainId,
        messageHash: args.messageHash,
      });
      expect(safeQueueService.clearMessagesBySafe).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: message.safe,
      });
    });

    it('resolves the message via the transaction service when disabled', async () => {
      const chainId = faker.number.int({ min: 1, max: 1000 });
      const disabledTarget = buildTargetWithQueueDisabled();
      const message = messageBuilder().build();
      mockTransactionApi.getMessageByHash.mockResolvedValue(rawify(message));
      mockSafeRepository.getSafe.mockResolvedValue(safeBuilder().build());
      const posted = rawify({ id: faker.string.uuid() });
      mockTransactionApi.postMessageSignature.mockResolvedValue(posted);
      const args = {
        chainId: String(chainId),
        messageHash: message.messageHash,
        signature: faker.string.hexadecimal({ length: 130 }) as Hex,
      };

      const result = await disabledTarget.updateMessageSignature(args);

      // getMessageByHash is always called first, regardless of routing.
      expect(mockTransactionApi.getMessageByHash).toHaveBeenCalledWith(
        args.messageHash,
      );
      expect(mockTransactionApi.postMessageSignature).toHaveBeenCalledWith({
        messageHash: args.messageHash,
        signature: args.signature,
      });
      expect(safeQueueService.postMessageSignature).not.toHaveBeenCalled();
      expect(result).toBe(posted);
    });
  });

  describe('clearMessagesBySafe / clearMessagesByHash', () => {
    it('clears both the tx-service and queue caches, independent of the flag', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const messageHash = faker.string.hexadecimal({ length: 64 }) as Hash;

      await target.clearMessagesBySafe({ chainId, safeAddress });
      await target.clearMessagesByHash({ chainId, messageHash });

      expect(mockTransactionApi.clearMessagesBySafe).toHaveBeenCalledWith({
        chainId,
        safeAddress,
      });
      expect(safeQueueService.clearMessagesBySafe).toHaveBeenCalledWith({
        chainId,
        safeAddress,
      });
      expect(mockTransactionApi.clearMessagesByHash).toHaveBeenCalledWith({
        chainId,
        messageHash,
      });
      expect(safeQueueService.clearMessagesByHash).toHaveBeenCalledWith({
        chainId,
        messageHash,
      });
    });

    it('swallows a failure in either layer, clears the other, and logs a warning', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      safeQueueService.clearMessagesBySafe.mockRejectedValueOnce(
        new Error('queue unavailable'),
      );

      await expect(
        target.clearMessagesBySafe({ chainId, safeAddress }),
      ).resolves.toBeUndefined();

      expect(mockTransactionApi.clearMessagesBySafe).toHaveBeenCalledWith({
        chainId,
        safeAddress,
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear queue messages cache'),
      );
    });
  });
});

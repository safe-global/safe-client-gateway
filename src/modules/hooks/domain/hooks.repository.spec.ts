// SPDX-License-Identifier: FSL-1.1-MIT
import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { ILoggingService } from '#/logging/logging.interface';
import type { BalancesRepository } from '#/modules/balances/domain/balances.repository';
import type { BlockchainRepository } from '#/modules/blockchain/domain/blockchain.repository';
import type { ChainsRepository } from '#/modules/chains/domain/chains.repository';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { CollectiblesRepository } from '#/modules/collectibles/domain/collectibles.repository';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '#/modules/contracts/domain/decoders/safe-decoder.helper';
import type { DelegatesV3Repository } from '#/modules/delegate/domain/v3/delegates.v3.repository';
import type { EarnRepository } from '#/modules/earn/domain/earn.repository';
import { EventCacheHelper } from '#/modules/hooks/domain/helpers/event-cache.helper';
import { HooksRepository } from '#/modules/hooks/domain/hooks.repository';
import { chainUpdateEventBuilder } from '#/modules/hooks/routes/entities/__tests__/chain-update.builder';
import { executedTransactionEventBuilder } from '#/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { incomingTokenEventBuilder } from '#/modules/hooks/routes/entities/__tests__/incoming-token.builder';
import { moduleTransactionEventBuilder } from '#/modules/hooks/routes/entities/__tests__/module-transaction.builder';
import type { MessagesRepository } from '#/modules/messages/domain/messages.repository';
import type { IPushNotificationService } from '#/modules/notifications/domain/push/push-notification.service.interface';
import type { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import type { QueuesRepository } from '#/modules/queues/domain/queues-repository';
import type { SafeRepository } from '#/modules/safe/domain/safe.repository';
import type { SafeAppsRepository } from '#/modules/safe-apps/domain/safe-apps.repository';
import type { StakingRepository } from '#/modules/staking/domain/staking.repository';
import type { TransactionsRepository } from '#/modules/transactions/domain/transactions.repository';
import type { ZerionCacheService } from '#/modules/zerion/datasources/zerion-cache.service';

const mockBalancesRepository = mocked({
  clearApi: jest.fn(),
  clearBalances: jest.fn(),
} as MockedObject<BalancesRepository>);

const mockBlockchainRepository = mocked({
  clearApi: jest.fn(),
} as MockedObject<BlockchainRepository>);

const mockChainsRepository = mocked({
  getChain: jest.fn(),
  getChains: jest.fn(),
  clearChain: jest.fn(),
  clearChainV2: jest.fn(),
  isSupportedChain: jest.fn(),
} as MockedObject<ChainsRepository>);

const mockCollectiblesRepository = mocked({
  clearCollectibles: jest.fn(),
} as MockedObject<CollectiblesRepository>);

const mockDelegatesRepository = mocked({
  clearDelegates: jest.fn(),
} as MockedObject<DelegatesV3Repository>);

const mockMessagesRepository = mocked({
  clearMessages: jest.fn(),
} as unknown as MockedObject<MessagesRepository>);

const mockSafeAppsRepository = mocked({
  clearSafeApps: jest.fn(),
} as MockedObject<SafeAppsRepository>);

const mockZerionCache = mocked({
  invalidate: jest.fn(),
} as MockedObject<ZerionCacheService>);

const mockSafeRepository = mocked({
  clearTransfers: jest.fn(),
  clearMultisigTransaction: jest.fn(),
  clearAllExecutedTransactions: jest.fn(),
  clearMultisigTransactions: jest.fn(),
  clearModuleTransactions: jest.fn(),
  clearIncomingTransfers: jest.fn(),
  clearSafe: jest.fn(),
} as MockedObject<SafeRepository>);

const mockStakingRepository = mocked({
  clearApi: jest.fn(),
  clearStakes: jest.fn(),
} as MockedObject<StakingRepository>);

const mockEarnRepository = mocked({
  clearApi: jest.fn(),
  clearStakes: jest.fn(),
} as MockedObject<EarnRepository>);

const mockTransactionsRepository = mocked({
  clearApi: jest.fn(),
} as MockedObject<TransactionsRepository>);

const mockLoggingService = mocked({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as MockedObject<ILoggingService>);

const mockPolicyIndexerRepository = mocked({
  getState: jest.fn(),
  clearState: jest.fn(),
} as MockedObject<IPolicyIndexerRepository>);

const mockQueuesRepository = mocked({
  subscribe: jest.fn(),
} as MockedObject<QueuesRepository>);

const mockConfigurationService = mocked({
  getOrThrow: jest.fn(),
} as MockedObject<IConfigurationService>);

const mockPushNotificationService = mocked({
  enqueueEvent: jest.fn(),
} as MockedObject<IPushNotificationService>);

describe('HooksRepository (Unit)', () => {
  let hooksRepository: HooksRepository;
  let fakeCacheService: FakeCacheService;
  let eventCacheHelper: EventCacheHelper;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeCacheService = new FakeCacheService();
    eventCacheHelper = new EventCacheHelper(
      mockBalancesRepository,
      mockBlockchainRepository,
      mockChainsRepository,
      mockCollectiblesRepository,
      mockDelegatesRepository,
      mockMessagesRepository,
      mockPolicyIndexerRepository,
      mockZerionCache,
      mockSafeAppsRepository,
      mockSafeRepository,
      mockStakingRepository,
      mockEarnRepository,
      mockTransactionsRepository,
      mockLoggingService,
      fakeCacheService,
      new SafeDecoder(),
      new MultiSendDecoder(mockLoggingService),
    );
    mockPushNotificationService.enqueueEvent.mockResolvedValue();
    hooksRepository = new HooksRepository(
      mockLoggingService,
      mockQueuesRepository,
      mockConfigurationService,
      mockPushNotificationService,
      eventCacheHelper,
    );
  });

  it('should forget the policy state of a safe after a policy change', async () => {
    // Every policy change is a Safe transaction.
    const chain = chainBuilder().build();
    const event = executedTransactionEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);

    await hooksRepository.onEvent(event);

    expect(mockPolicyIndexerRepository.clearState).toHaveBeenCalledWith({
      chainId: event.chainId,
      safeAddress: event.address,
    });
  });

  it('should forget the policy state of a safe after a module transaction', async () => {
    // An allowance transfer moves what a spending limit has left, without
    // changing any configuration.
    const chain = chainBuilder().build();
    const event = moduleTransactionEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);

    await hooksRepository.onEvent(event);

    expect(mockPolicyIndexerRepository.clearState).toHaveBeenCalledWith({
      chainId: event.chainId,
      safeAddress: event.address,
    });
  });

  it('should not forget the policy state on an unrelated event', async () => {
    const chain = chainBuilder().build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);

    await hooksRepository.onEvent(
      incomingTokenEventBuilder().with('chainId', chain.chainId).build(),
    );

    expect(mockPolicyIndexerRepository.clearState).not.toHaveBeenCalled();
  });

  it('should process events for known chains and memoize the chain lookup', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);

    // same event 3 times
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);

    // only one call to isSupportedChain
    expect(mockChainsRepository.isSupportedChain).toHaveBeenCalledTimes(1);
    expect(mockChainsRepository.isSupportedChain).toHaveBeenCalledWith(
      event.chainId,
    );

    // 3 calls to repositories
    expect(mockBalancesRepository.clearBalances).toHaveBeenCalledTimes(3);
    expect(mockCollectiblesRepository.clearCollectibles).toHaveBeenCalledTimes(
      3,
    );
    expect(
      mockSafeRepository.clearAllExecutedTransactions,
    ).toHaveBeenCalledTimes(3);
    expect(mockSafeRepository.clearMultisigTransactions).toHaveBeenCalledTimes(
      3,
    );
    expect(mockSafeRepository.clearTransfers).toHaveBeenCalledTimes(3);
    expect(mockSafeRepository.clearIncomingTransfers).toHaveBeenCalledTimes(3);
  });

  it('should process CHAIN_UPDATE events for unsupported chains', async () => {
    const chain = chainBuilder().build();
    const event = chainUpdateEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(false);
    mockChainsRepository.clearChain.mockResolvedValue();
    mockChainsRepository.clearChainV2.mockResolvedValue();

    // same event 3 times
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);

    // 3 calls to isSupportedChain
    expect(mockChainsRepository.isSupportedChain).toHaveBeenCalledTimes(3);
    expect(mockChainsRepository.isSupportedChain).toHaveBeenCalledWith(
      event.chainId,
    );

    // 3 calls to repositories
    expect(mockChainsRepository.clearChain).toHaveBeenCalledTimes(3);
    expect(mockChainsRepository.clearChainV2).toHaveBeenCalledTimes(3);
    expect(mockBlockchainRepository.clearApi).toHaveBeenCalledTimes(3);
    expect(mockStakingRepository.clearApi).toHaveBeenCalledTimes(3);
    expect(mockEarnRepository.clearApi).toHaveBeenCalledTimes(3);
    expect(mockTransactionsRepository.clearApi).toHaveBeenCalledTimes(3);
    expect(mockBalancesRepository.clearApi).toHaveBeenCalledTimes(3);
  });

  it('should clear the chain lookup cache on a CHAIN_UPDATE event', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);
    mockChainsRepository.clearChain.mockResolvedValue();
    mockChainsRepository.clearChainV2.mockResolvedValue();

    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(
      chainUpdateEventBuilder().with('chainId', chain.chainId).build(),
    );
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);

    // 2 calls to isSupportedChain
    expect(mockChainsRepository.isSupportedChain).toHaveBeenCalledTimes(2);

    // 5 calls to repositories
    expect(mockBalancesRepository.clearBalances).toHaveBeenCalledTimes(5);
    expect(mockCollectiblesRepository.clearCollectibles).toHaveBeenCalledTimes(
      5,
    );
    expect(
      mockSafeRepository.clearAllExecutedTransactions,
    ).toHaveBeenCalledTimes(5);
    expect(mockSafeRepository.clearMultisigTransactions).toHaveBeenCalledTimes(
      5,
    );
    expect(mockSafeRepository.clearTransfers).toHaveBeenCalledTimes(5);
    expect(mockSafeRepository.clearIncomingTransfers).toHaveBeenCalledTimes(5);
  });

  it('should not process events for unknown chains', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(false);

    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);

    // only one call to isSupportedChain
    expect(mockChainsRepository.isSupportedChain).toHaveBeenCalledTimes(1);

    // event not processed, no calls to repositories
    expect(mockBalancesRepository.clearBalances).not.toHaveBeenCalled();
    expect(mockCollectiblesRepository.clearCollectibles).not.toHaveBeenCalled();
    expect(
      mockSafeRepository.clearAllExecutedTransactions,
    ).not.toHaveBeenCalled();
    expect(mockSafeRepository.clearMultisigTransactions).not.toHaveBeenCalled();
    expect(mockSafeRepository.clearTransfers).not.toHaveBeenCalled();
    expect(mockSafeRepository.clearIncomingTransfers).not.toHaveBeenCalled();
  });

  it('should store the unsupported chain events and log them after UNSUPPORTED_EVENTS_LOG_INTERVAL', async () => {
    const chain = chainBuilder().build();
    const chains = pageBuilder<typeof chain>().with('results', [chain]).build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    const cacheKey = `${chain.chainId}_unsupported_chain_event`;
    mockChainsRepository.isSupportedChain.mockResolvedValue(false);
    mockChainsRepository.getChains.mockResolvedValue(chains);

    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);
    await hooksRepository.onEvent(event);

    await expect(fakeCacheService.getCounter(cacheKey)).resolves.toEqual(3);
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
    await eventCacheHelper.logUnsupportedEvents();
    expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      type: 'unsupported_chain_event',
      chainId: chain.chainId,
      count: 3,
    });
    // cache should be cleared after logging
    await expect(fakeCacheService.getCounter(cacheKey)).resolves.toBeNull();
  });

  it('should store the unsupported chain events for several chains and log them after UNSUPPORTED_EVENTS_LOG_INTERVAL', async () => {
    const chains = [
      chainBuilder().with('chainId', '1').build(),
      chainBuilder().with('chainId', '2').build(),
    ];
    const chainsPage = pageBuilder<(typeof chains)[0]>()
      .with('results', chains)
      .build();
    const events = [
      incomingTokenEventBuilder().with('chainId', chains[0].chainId).build(),
      incomingTokenEventBuilder().with('chainId', chains[1].chainId).build(),
    ];
    const cacheKeys = [
      `${chains[0].chainId}_unsupported_chain_event`,
      `${chains[1].chainId}_unsupported_chain_event`,
    ];
    mockChainsRepository.isSupportedChain.mockResolvedValue(false);
    mockChainsRepository.getChains.mockResolvedValue(chainsPage);

    await hooksRepository.onEvent(events[0]);
    await hooksRepository.onEvent(events[0]);
    await hooksRepository.onEvent(events[1]);
    await hooksRepository.onEvent(events[1]);
    await hooksRepository.onEvent(events[0]);
    await hooksRepository.onEvent(events[0]);
    await hooksRepository.onEvent(events[1]);

    await expect(fakeCacheService.getCounter(cacheKeys[0])).resolves.toEqual(4);
    await expect(fakeCacheService.getCounter(cacheKeys[1])).resolves.toEqual(3);
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
    await eventCacheHelper.logUnsupportedEvents();
    expect(mockLoggingService.warn).toHaveBeenCalledTimes(2);
    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      type: 'unsupported_chain_event',
      chainId: chains[0].chainId,
      count: 4,
    });
    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      type: 'unsupported_chain_event',
      chainId: chains[1].chainId,
      count: 3,
    });
    // cache should be cleared after logging
    await expect(fakeCacheService.getCounter(cacheKeys[0])).resolves.toBeNull();
    await expect(fakeCacheService.getCounter(cacheKeys[1])).resolves.toBeNull();
  });

  it('should call enqueueEvent for supported chain events', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);

    await hooksRepository.onEvent(event);

    expect(mockPushNotificationService.enqueueEvent).toHaveBeenCalledTimes(1);
    expect(mockPushNotificationService.enqueueEvent).toHaveBeenCalledWith(
      event,
    );
  });

  it('should not throw if enqueueEvent rejects', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);
    mockPushNotificationService.enqueueEvent.mockRejectedValue(
      new Error('Queue unavailable'),
    );

    await expect(hooksRepository.onEvent(event)).resolves.toBeDefined();

    expect(mockPushNotificationService.enqueueEvent).toHaveBeenCalledTimes(1);
  });

  it('should not call enqueueEvent for unsupported chain events', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(false);

    await hooksRepository.onEvent(event);

    expect(mockPushNotificationService.enqueueEvent).not.toHaveBeenCalled();
  });
});

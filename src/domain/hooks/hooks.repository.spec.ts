import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import type { BalancesRepository } from '@/domain/balances/balances.repository';
import type { BlockchainRepository } from '@/domain/blockchain/blockchain.repository';
import type { ChainsRepository } from '@/domain/chains/chains.repository';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import type { CollectiblesRepository } from '@/domain/collectibles/collectibles.repository';
import type { DelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository';
import type { EarnRepository } from '@/domain/earn/earn.repository';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { EventCacheHelper } from '@/domain/hooks/helpers/event-cache.helper';
import type { EventNotificationsHelper } from '@/domain/hooks/helpers/event-notifications.helper';
import { HooksRepository } from '@/domain/hooks/hooks.repository';
import type { MessagesRepository } from '@/domain/messages/messages.repository';
import type { QueuesRepository } from '@/domain/queues/queues-repository';
import type { SafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository';
import type { SafeRepository } from '@/domain/safe/safe.repository';
import type { StakingRepository } from '@/domain/staking/staking.repository';
import type { TransactionsRepository } from '@/domain/transactions/transactions.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { chainUpdateEventBuilder } from '@/routes/hooks/entities/__tests__/chain-update.builder';
import { incomingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-token.builder';

const mockBalancesRepository = jest.mocked({
  clearApi: jest.fn(),
  clearBalances: jest.fn(),
} as jest.MockedObjectDeep<BalancesRepository>);

const mockBlockchainRepository = jest.mocked({
  clearApi: jest.fn(),
} as jest.MockedObjectDeep<BlockchainRepository>);

const mockChainsRepository = jest.mocked({
  getChain: jest.fn(),
  getChains: jest.fn(),
  clearChain: jest.fn(),
  isSupportedChain: jest.fn(),
} as jest.MockedObjectDeep<ChainsRepository>);

const mockCollectiblesRepository = jest.mocked({
  clearCollectibles: jest.fn(),
} as jest.MockedObjectDeep<CollectiblesRepository>);

const mockDelegatesRepository = jest.mocked({
  clearDelegates: jest.fn(),
} as jest.MockedObjectDeep<DelegatesV2Repository>);

const mockMessagesRepository = jest.mocked({
  clearMessages: jest.fn(),
} as unknown as jest.MockedObjectDeep<MessagesRepository>);

const mockSafeAppsRepository = jest.mocked({
  clearSafeApps: jest.fn(),
} as jest.MockedObjectDeep<SafeAppsRepository>);

const mockSafeRepository = jest.mocked({
  clearTransfers: jest.fn(),
  clearMultisigTransaction: jest.fn(),
  clearAllExecutedTransactions: jest.fn(),
  clearMultisigTransactions: jest.fn(),
  clearModuleTransactions: jest.fn(),
  clearIncomingTransfers: jest.fn(),
  clearSafe: jest.fn(),
} as jest.MockedObjectDeep<SafeRepository>);

const mockStakingRepository = jest.mocked({
  clearApi: jest.fn(),
} as jest.MockedObjectDeep<StakingRepository>);

const mockEarnRepository = jest.mocked({
  clearApi: jest.fn(),
} as jest.MockedObjectDeep<EarnRepository>);

const mockTransactionsRepository = jest.mocked({
  clearApi: jest.fn(),
} as jest.MockedObjectDeep<TransactionsRepository>);

const mockLoggingService = jest.mocked({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockQueuesRepository = jest.mocked({
  subscribe: jest.fn(),
} as jest.MockedObjectDeep<QueuesRepository>);

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockEventNotificationsHelper = jest.mocked({
  onEventEnqueueNotifications: jest.fn(),
} as jest.MockedObjectDeep<EventNotificationsHelper>);

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
      mockSafeAppsRepository,
      mockSafeRepository,
      mockStakingRepository,
      mockEarnRepository,
      mockTransactionsRepository,
      mockLoggingService,
      fakeCacheService,
    );
    hooksRepository = new HooksRepository(
      mockLoggingService,
      mockQueuesRepository,
      mockConfigurationService,
      mockEventNotificationsHelper,
      eventCacheHelper,
    );
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
});

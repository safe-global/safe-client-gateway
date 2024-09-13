import { IConfigurationService } from '@/config/configuration.service.interface';
import { BalancesRepository } from '@/domain/balances/balances.repository';
import { BlockchainRepository } from '@/domain/blockchain/blockchain.repository';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { CollectiblesRepository } from '@/domain/collectibles/collectibles.repository';
import { EventNotificationsHelper } from '@/domain/hooks/helpers/event-notifications.helper';
import {
  HooksRepository,
  HooksRepositoryWithNotifications,
} from '@/domain/hooks/hooks.repository';
import { MessagesRepository } from '@/domain/messages/messages.repository';
import { QueuesRepository } from '@/domain/queues/queues-repository';
import { SafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { TransactionsRepository } from '@/domain/transactions/transactions.repository';
import { ILoggingService } from '@/logging/logging.interface';
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
  clearChain: jest.fn(),
  isSupportedChain: jest.fn(),
} as jest.MockedObjectDeep<ChainsRepository>);

const mockCollectiblesRepository = jest.mocked({
  clearCollectibles: jest.fn(),
} as jest.MockedObjectDeep<CollectiblesRepository>);

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

  beforeEach(() => {
    hooksRepository = new HooksRepository(
      mockBalancesRepository,
      mockBlockchainRepository,
      mockChainsRepository,
      mockCollectiblesRepository,
      mockMessagesRepository,
      mockSafeAppsRepository,
      mockSafeRepository,
      mockStakingRepository,
      mockTransactionsRepository,
      mockLoggingService,
      mockQueuesRepository,
      mockConfigurationService,
    );
    jest.clearAllMocks();
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
});

describe('HooksRepositoryWithNotifications (Unit)', () => {
  let hooksRepositoryWithNotifications: HooksRepositoryWithNotifications;

  beforeEach(() => {
    hooksRepositoryWithNotifications = new HooksRepositoryWithNotifications(
      mockBalancesRepository,
      mockBlockchainRepository,
      mockChainsRepository,
      mockCollectiblesRepository,
      mockMessagesRepository,
      mockSafeAppsRepository,
      mockSafeRepository,
      mockStakingRepository,
      mockTransactionsRepository,
      mockLoggingService,
      mockQueuesRepository,
      mockConfigurationService,
      mockEventNotificationsHelper,
    );
    jest.clearAllMocks();
  });

  it('should process events for known chains and memoize the chain lookup', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);

    // same event 3 times
    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);

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

  it('should clear the chain lookup cache on a CHAIN_UPDATE event', async () => {
    const chain = chainBuilder().build();
    const event = incomingTokenEventBuilder()
      .with('chainId', chain.chainId)
      .build();
    mockChainsRepository.isSupportedChain.mockResolvedValue(true);
    mockChainsRepository.clearChain.mockResolvedValue();

    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(
      chainUpdateEventBuilder().with('chainId', chain.chainId).build(),
    );
    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);

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

    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);
    await hooksRepositoryWithNotifications.onEvent(event);

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
});

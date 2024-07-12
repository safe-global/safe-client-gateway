import { logBuilder } from '@/domain/blockchain/__tests__/log.builder';
import {
  sanctionedAddressesAddedEventBuilder,
  sanctionedAddressesRemovedEventBuilder,
} from '@/domain/blockchain/__tests__/sanctioned-addresses-encoder.builder';
import { transactionReceiptBuilder } from '@/domain/blockchain/__tests__/transaction-receipt.builder';
import { SanctionedAddressesIndexer } from '@/domain/blockchain/sanctioned-addresses.indexer';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { PublicClient } from 'viem';

const mockPublicClient = jest.mocked({
  getTransactionReceipt: jest.fn(),
  getBlockNumber: jest.fn(),
  getContractEvents: jest.fn(),
} as jest.MockedObjectDeep<PublicClient>);

const mockBlockchainApiManager = jest.mocked({
  getApi: jest.fn(),
} as jest.MockedObjectDeep<IBlockchainApiManager>);

const mockLoggingService = jest.mocked({
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('SanctionedAddressesIndexer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns sanctioned addresses since contract creation', async () => {
    const receipt = transactionReceiptBuilder().build();
    const blockNumber = faker.number.bigInt({ min: receipt.blockNumber });
    const sanctionedAddressesAddedEvent =
      sanctionedAddressesAddedEventBuilder();
    const { data, topics } = sanctionedAddressesAddedEvent.encode();
    const eventLog = {
      ...logBuilder().with('data', data).with('topics', topics).build(),
      args: sanctionedAddressesAddedEvent.build(),
      eventName: 'SanctionedAddressesAdded',
    };
    mockPublicClient.getTransactionReceipt.mockResolvedValue(receipt);
    mockPublicClient.getBlockNumber.mockResolvedValue(blockNumber);
    mockPublicClient.getContractEvents.mockResolvedValue([eventLog]);
    mockBlockchainApiManager.getApi.mockResolvedValue(mockPublicClient);
    const target = new SanctionedAddressesIndexer(
      mockBlockchainApiManager,
      mockLoggingService,
    );

    const result = await target.getSanctionedAddresses('1');

    expect(result).toStrictEqual(sanctionedAddressesAddedEvent.build().addrs);
  });

  it('does not return duplicate addresses', async () => {
    const receipt = transactionReceiptBuilder().build();
    const blockNumber = faker.number.bigInt({ min: receipt.blockNumber });
    const sanctionedAddressesAddedEvent =
      sanctionedAddressesAddedEventBuilder();
    const { data, topics } = sanctionedAddressesAddedEvent.encode();
    const eventLog = {
      ...logBuilder().with('data', data).with('topics', topics).build(),
      args: sanctionedAddressesAddedEvent.build(),
      eventName: 'SanctionedAddressesAdded',
    };
    mockPublicClient.getTransactionReceipt.mockResolvedValue(receipt);
    mockPublicClient.getBlockNumber.mockResolvedValue(blockNumber);
    // Multiple events
    mockPublicClient.getContractEvents.mockResolvedValue([
      eventLog,
      eventLog,
      eventLog,
    ]);
    mockBlockchainApiManager.getApi.mockResolvedValue(mockPublicClient);
    const target = new SanctionedAddressesIndexer(
      mockBlockchainApiManager,
      mockLoggingService,
    );

    const result = await target.getSanctionedAddresses('1');

    expect(result).toStrictEqual(sanctionedAddressesAddedEvent.build().addrs);
    expect(result.length).toBe(1);
  });

  it('does not include sanctioned addresses that were later removed', async () => {
    const receipt = transactionReceiptBuilder().build();
    const blockNumber = faker.number.bigInt({ min: receipt.blockNumber });
    const sanctionedAddressesAddedEvent =
      sanctionedAddressesAddedEventBuilder();
    const sanctionedAddressAddedEventArgs =
      sanctionedAddressesAddedEvent.build();
    const encodedSactionedAddressesAddedEvent =
      sanctionedAddressesAddedEvent.encode();
    const addEventLog = {
      ...logBuilder()
        .with('data', encodedSactionedAddressesAddedEvent.data)
        .with('topics', encodedSactionedAddressesAddedEvent.topics)
        .build(),
      args: sanctionedAddressAddedEventArgs,
      eventName: 'SanctionedAddressesAdded',
    };
    const sanctionedAddressesRemovedEvent =
      sanctionedAddressesRemovedEventBuilder().with(
        'addrs',
        sanctionedAddressAddedEventArgs.addrs,
      );
    const encodedSactionedAddressesRemovedEvent =
      sanctionedAddressesAddedEvent.encode();
    const removeEventLog = {
      ...logBuilder()
        .with('data', encodedSactionedAddressesRemovedEvent.data)
        .with('topics', encodedSactionedAddressesRemovedEvent.topics)
        .build(),
      args: sanctionedAddressesRemovedEvent.build(),
      eventName: 'SanctionedAddressesRemoved',
    };

    mockPublicClient.getTransactionReceipt.mockResolvedValue(receipt);
    mockPublicClient.getBlockNumber.mockResolvedValue(blockNumber);
    // Added then removed
    mockPublicClient.getContractEvents.mockResolvedValue([
      addEventLog,
      removeEventLog,
    ]);
    mockBlockchainApiManager.getApi.mockResolvedValue(mockPublicClient);
    const target = new SanctionedAddressesIndexer(
      mockBlockchainApiManager,
      mockLoggingService,
    );

    const result = await target.getSanctionedAddresses('1');

    expect(result).toStrictEqual([]);
  });

  // TODO: Write tests for the following once implemented
  it.todo('caches and returns cached sanctioned addresses');

  it.todo('indexes sanctioned addresses since last indexed block');

  it.todo('runs a job to index sanctioned addresses');

  it.todo("does't index sanctioned addresses if already indexed");
});

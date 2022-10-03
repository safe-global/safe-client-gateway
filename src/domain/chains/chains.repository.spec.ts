import { faker } from '@faker-js/faker';
import { IConfigApi } from '../interfaces/config-api.interface';
import { ChainsRepository } from './chains.repository';
import { ChainsValidator } from './chains.validator';
import chainFactory from './entities/__tests__/chain.factory';
import { Chain } from './entities/chain.entity';
import { Page } from '../entities/page.entity';
import { MasterCopyValidator } from './master-copy.validator';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';

const CHAIN = chainFactory();
const CHAINS: Page<Chain> = {
  count: faker.datatype.number(),
  results: [chainFactory(), chainFactory()],
};

const mockConfigApi = jest.mocked({
  getChain: jest.fn(),
  getChains: jest.fn(),
} as unknown as IConfigApi);

const transactionApiManager = {
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager;
const mockTransactionApiManager = jest.mocked(transactionApiManager);

const mockChainValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as ChainsValidator);

const mockMasterCopyValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as MasterCopyValidator);

describe('Chain Repository', () => {
  const repository = new ChainsRepository(
    mockConfigApi,
    mockTransactionApiManager,
    mockChainValidator,
    mockMasterCopyValidator,
  );

  it('should return and validate a Chain from ConfigAPI', async () => {
    mockConfigApi.getChain.mockResolvedValue(CHAIN);
    mockChainValidator.validate = jest.fn().mockResolvedValue(CHAIN);

    const data = await repository.getChain(faker.random.word());

    expect(mockChainValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(CHAIN);
  });

  it('should return and validate a Chain[] from ConfigAPI', async () => {
    mockConfigApi.getChains.mockResolvedValue(CHAINS);
    mockChainValidator.validate = jest
      .fn()
      .mockResolvedValue(CHAINS.results[0]);

    const data = await repository.getChains();

    expect(mockChainValidator.validate).toBeCalledTimes(CHAINS.results.length);
    expect(data).toBe(CHAINS);
  });
});

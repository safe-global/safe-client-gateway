import { faker } from '@faker-js/faker';
import { IConfigApi } from '../interfaces/config-api.interface';
import { ChainsRepository } from './chains.repository';
import { ChainsValidator } from './chains.validator';
import chainFactory from './entities/__tests__/chain.factory';
import { Chain } from './entities/chain.entity';
import { Page } from '../entities/page.entity';
import { MasterCopyValidator } from './master-copy.validator';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';

const mockConfigApi = jest.mocked({
  getChain: jest.fn(),
  getChains: jest.fn(),
} as unknown as IConfigApi);

const mockTransactionApiManager = jest.mocked({
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager);

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
    const chain = chainFactory();
    mockConfigApi.getChain.mockResolvedValue(chain);
    mockChainValidator.validate = jest.fn().mockResolvedValue(chain);

    const data = await repository.getChain(faker.random.word());

    expect(mockChainValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(chain);
  });

  it('should return and validate a Chain[] from ConfigAPI', async () => {
    const chains: Page<Chain> = {
      count: faker.datatype.number(),
      results: [chainFactory(), chainFactory()],
    };

    mockConfigApi.getChains.mockResolvedValue(chains);
    mockChainValidator.validate = jest
      .fn()
      .mockResolvedValue(chains.results[0]);

    const data = await repository.getChains();

    expect(mockChainValidator.validate).toBeCalledTimes(chains.results.length);
    expect(data).toBe(chains);
  });
});

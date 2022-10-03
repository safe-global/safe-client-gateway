import { faker } from '@faker-js/faker';
import { IConfigApi } from '../interfaces/config-api.interface';
import { ChainsRepository } from './chains.repository';
import { ChainsValidator } from './chains.validator';
import { Page } from '../../common/entities/page.entity';
import chainFactory from './entities/__tests__/chain.factory';
import { Chain } from './entities/chain.entity';

const CHAIN = chainFactory();
const CHAINS: Page<Chain> = {
  count: faker.datatype.number(),
  results: [chainFactory(), chainFactory()],
};

const configApi = {
  getChain: jest.fn(),
  getChains: jest.fn(),
} as unknown as IConfigApi;

const chainValidator = {
  validate: jest.fn(),
} as unknown as ChainsValidator;

const mockConfigApi = jest.mocked(configApi);
const mockChainValidator = jest.mocked(chainValidator);

describe('Chain Repository', () => {
  const repository = new ChainsRepository(mockConfigApi, mockChainValidator);

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

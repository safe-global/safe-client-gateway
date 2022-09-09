import { faker } from "@faker-js/faker";
import { IConfigApi } from "../interfaces/config-api.interface";
import { ChainsRepository } from "./chains.repository";
import { ChainsValidator } from "./chains.validator";
import chainFactory from "./entities/__tests__/chain.factory";

const CHAIN = chainFactory();
const CHAINS = [chainFactory(), chainFactory()];

const configApi = {
  getChain: jest.fn().mockResolvedValue(CHAIN),
  getChains: jest.fn().mockResolvedValue(CHAINS),
} as unknown as IConfigApi;

const chainValidator = {
  validate: jest.fn().mockResolvedValue(CHAIN),
} as unknown as ChainsValidator;

const mockConfigApi = jest.mocked(configApi);
const mockChainValidator = jest.mocked(chainValidator);

describe('Chain Repository', () => {
  const repository = new ChainsRepository(
    mockConfigApi,
    mockChainValidator,
  );

  it('should return the data coming from the ConfigAPI', async () => {
    const data = await repository.getChain(faker.random.word());
    expect(mockChainValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(CHAIN);
  });
});
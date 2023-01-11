import { faker } from '@faker-js/faker';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ContractsRepository } from './contracts.repository';
import { ContractsValidator } from './contracts.validator';
import { contractBuilder } from './entities/__tests__/contract.builder';

const mockTransactionApi = jest.mocked({
  getContract: jest.fn(),
} as unknown as ITransactionApi);

const mockTransactionApiManager = jest.mocked({
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager);

const mockContractsValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as ContractsValidator);

describe('Contracts Repository', () => {
  const repository = new ContractsRepository(
    mockTransactionApiManager,
    mockContractsValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    const contract = contractBuilder().build();
    mockTransactionApi.getContract.mockResolvedValue(contract);
    mockContractsValidator.validate = jest.fn().mockResolvedValue(contract);
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      mockTransactionApi,
    );

    const data = await repository.getContract(
      faker.datatype.uuid(),
      faker.finance.ethereumAddress(),
    );

    expect(mockContractsValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(contract);
  });
});

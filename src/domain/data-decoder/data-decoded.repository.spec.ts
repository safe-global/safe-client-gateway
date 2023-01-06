import { faker } from '@faker-js/faker';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { DataDecodedRepository } from './data-decoded.repository';
import { DataDecodedValidator } from './data-decoded.validator';
import { dataDecodedBuilder } from './entities/__tests__/data-decoded.builder';

const mockTransactionApi = jest.mocked({
  getDataDecoded: jest.fn(),
} as unknown as ITransactionApi);

const mockTransactionApiManager = jest.mocked({
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager);

const mockDataDecodedValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as DataDecodedValidator);

describe('DataDecoded Repository', () => {
  const repository = new DataDecodedRepository(
    mockTransactionApiManager,
    mockDataDecodedValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    const dataDecoded = dataDecodedBuilder().build();
    mockTransactionApi.getDataDecoded.mockResolvedValue(dataDecoded);
    mockDataDecodedValidator.validate = jest
      .fn()
      .mockResolvedValue(dataDecoded);
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      mockTransactionApi,
    );

    const data = await repository.getDataDecoded(
      faker.random.word(),
      faker.random.alphaNumeric(),
      faker.finance.ethereumAddress(),
    );

    expect(mockDataDecodedValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(dataDecoded);
  });
});

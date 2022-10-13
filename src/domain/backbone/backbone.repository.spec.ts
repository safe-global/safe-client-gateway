import { faker } from '@faker-js/faker';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BackboneRepository } from './backbone.repository';
import { BackboneValidator } from './backbone.validator';

const mockTransactionApi = jest.mocked({
  getBackbone: jest.fn(),
} as unknown as ITransactionApi);

const mockTransactionApiManager = jest.mocked({
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager);

const mockBackboneValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as BackboneValidator);

describe('Backbone Repository', () => {
  const repository = new BackboneRepository(
    mockTransactionApiManager,
    mockBackboneValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    const backbone = backboneFactory();
    mockTransactionApi.getBackbone.mockResolvedValue(backbone);
    mockBackboneValidator.validate = jest.fn().mockResolvedValue(backbone);
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      mockTransactionApi,
    );

    const data = await repository.getBackbone(faker.random.word());

    expect(mockBackboneValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(backbone);
  });
});

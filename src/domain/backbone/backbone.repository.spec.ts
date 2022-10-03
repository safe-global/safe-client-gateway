import { faker } from '@faker-js/faker';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BackboneRepository } from './backbone.repository';
import { BackboneValidator } from './backbone.validator';
import { Backbone } from './entities/backbone.entity';

const BACKBONE: Backbone = backboneFactory();

const transactionApi = {
  getBackbone: jest.fn(),
} as unknown as ITransactionApi;
const mockTransactionApi = jest.mocked(transactionApi);

const transactionApiManager = {
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager;
const mockTransactionApiManager = jest.mocked(transactionApiManager);

const backboneValidator = {
  validate: jest.fn(),
} as unknown as BackboneValidator;
const mockBackboneValidator = jest.mocked(backboneValidator);

describe('Backbone Repository', () => {
  const repository = new BackboneRepository(
    mockTransactionApiManager,
    mockBackboneValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    mockTransactionApi.getBackbone.mockResolvedValue(BACKBONE);
    mockBackboneValidator.validate = jest.fn().mockResolvedValue(BACKBONE);
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      transactionApi,
    );

    const data = await repository.getBackbone(faker.random.word());

    expect(mockBackboneValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(BACKBONE);
  });
});

import { faker } from '@faker-js/faker';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BackboneRepository } from './backbone.repository';
import { BackboneValidator } from './backbone.validator';
import { Backbone } from './entities/backbone.entity';

const BACKBONE: Backbone = backboneFactory();

const transactionApi = {
  getBackbone: jest.fn().mockResolvedValue(BACKBONE),
} as unknown as ITransactionApi;

const transactionApiManager = {
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager;

const backboneValidator = {
  validate: jest.fn().mockResolvedValue(BACKBONE),
} as unknown as BackboneValidator;

const mockTransactionApiManager = jest.mocked(transactionApiManager);
const mockBackboneValidator = jest.mocked(backboneValidator);

describe('Backbone Repository', () => {
  const repository = new BackboneRepository(
    mockTransactionApiManager,
    mockBackboneValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      transactionApi,
    );

    const data = await repository.getBackbone(faker.random.word());

    expect(mockBackboneValidator.validate).toBeCalledTimes(1);
    expect(data).toBe(BACKBONE);
  });
});

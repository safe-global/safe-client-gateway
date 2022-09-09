import { HttpException } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BalancesRepository } from './balances.repository';
import { Balance } from './entities/balance.entity';
import { balanceFactory } from './entities/__tests__/balance.factory';

const BALANCES: Balance[] = [balanceFactory(), balanceFactory()];

const transactionApi = {
  getBalances: jest.fn().mockResolvedValue(BALANCES),
} as unknown as ITransactionApi;

const transactionApiManager = {
  getTransactionApi: jest.fn().mockResolvedValue(transactionApi),
} as unknown as ITransactionApiManager;

const validationErrorFactory = {
  from: jest.fn().mockReturnValue(new HttpException('testErr', 500)),
} as unknown as ValidationErrorFactory;

const validationFunction = jest.fn();
validationFunction.mockImplementation(() => true);

const jsonSchemaService = {
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService;

const mockTransactionApiManager = jest.mocked(transactionApiManager);
const mockValidationErrorFactory = jest.mocked(validationErrorFactory);
const mockJsonSchemaService = jest.mocked(jsonSchemaService);

describe('Balances Repository', () => {
  const repository = new BalancesRepository(
    mockTransactionApiManager,
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    const data = await repository.getBalances(
      faker.random.word(),
      faker.random.word(),
    );

    expect(data).toBe(BALANCES);
  });

  it('should throw a validation error when validation fails', async () => {
    validationFunction.mockImplementationOnce(() => false);

    await expect(
      repository.getBalances(faker.random.word(), faker.random.word()),
    ).rejects.toThrow();

    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

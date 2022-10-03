import { faker } from '@faker-js/faker';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BalancesRepository } from './balances.repository';
import { Balance } from './entities/balance.entity';
import { balanceFactory } from './entities/__tests__/balance.factory';
import { BalancesValidator } from './balances.validator';

const BALANCES: Balance[] = [balanceFactory(), balanceFactory()];

const transactionApi = {
  getBalances: jest.fn(),
} as unknown as ITransactionApi;
const mockTransactionApi = jest.mocked(transactionApi);

const transactionApiManager = {
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager;
const mockTransactionApiManager = jest.mocked(transactionApiManager);

const balancesValidator = {
  validate: jest.fn(),
} as unknown as BalancesValidator;
const mockBalancesValidator = jest.mocked(balancesValidator);

describe('Balances Repository', () => {
  const repository = new BalancesRepository(
    mockTransactionApiManager,
    mockBalancesValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    mockTransactionApi.getBalances.mockResolvedValue(BALANCES);
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      transactionApi,
    );
    mockBalancesValidator.validate = jest
      .fn()
      .mockImplementation((balance) => balance);

    const data = await repository.getBalances(
      faker.random.word(),
      faker.random.word(),
    );

    expect(mockBalancesValidator.validate).toBeCalledTimes(BALANCES.length);
    expect(data).toEqual(BALANCES);
  });
});

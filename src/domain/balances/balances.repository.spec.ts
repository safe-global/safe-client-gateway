import { faker } from '@faker-js/faker';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BalancesRepository } from './balances.repository';
import { Balance } from './entities/balance.entity';
import { balanceFactory } from './entities/__tests__/balance.factory';
import { BalancesValidator } from './balances.validator';

const BALANCES: Balance[] = [balanceFactory(), balanceFactory()];

const transactionApi = {
  getBalances: jest.fn().mockResolvedValue(BALANCES),
} as unknown as ITransactionApi;

const transactionApiManager = {
  getTransactionApi: jest.fn().mockResolvedValue(transactionApi),
} as unknown as ITransactionApiManager;

const balancesValidator = {
  validateMany: jest.fn().mockResolvedValue(BALANCES),
} as unknown as BalancesValidator;

const mockTransactionApiManager = jest.mocked(transactionApiManager);
const mockBalancesValidator = jest.mocked(balancesValidator);

describe('Balances Repository', () => {
  const repository = new BalancesRepository(
    mockTransactionApiManager,
    mockBalancesValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    const data = await repository.getBalances(
      faker.random.word(),
      faker.random.word(),
    );

    expect(mockBalancesValidator.validateMany).toBeCalledTimes(1);
    expect(data).toBe(BALANCES);
  });
});

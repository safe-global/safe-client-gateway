import { faker } from '@faker-js/faker';
import { ITransactionApi } from '../interfaces/transaction-api.interface';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BalancesRepository } from './balances.repository';
import { Balance } from './entities/balance.entity';
import { BalancesValidator } from './balances.validator';
import { balanceBuilder } from './entities/__tests__/balance.builder';

const BALANCES: Balance[] = [
  balanceBuilder().build(),
  balanceBuilder().build(),
];

const mockTransactionApi = jest.mocked({
  getBalances: jest.fn(),
} as unknown as ITransactionApi);

const mockTransactionApiManager = jest.mocked({
  getTransactionApi: jest.fn(),
} as unknown as ITransactionApiManager);

const mockBalancesValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as BalancesValidator);

describe('Balances Repository', () => {
  const repository = new BalancesRepository(
    mockTransactionApiManager,
    mockBalancesValidator,
  );

  it('should return the data coming from the TransactionAPI', async () => {
    mockTransactionApi.getBalances.mockResolvedValue(BALANCES);
    mockTransactionApiManager.getTransactionApi.mockResolvedValue(
      mockTransactionApi,
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

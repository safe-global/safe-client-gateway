import { BalancesService } from './balances.service';
import { IExchangeRepository } from '../../domain/exchange/exchange.repository.interface';
import { IBalancesRepository } from '../../domain/balances/balances.repository.interface';
import { IChainsRepository } from '../../domain/chains/chains.repository.interface';

const balancesRepository = {} as unknown as IBalancesRepository;
const balancesRepositoryMock = jest.mocked(balancesRepository);

const chainsRepository = {} as unknown as IChainsRepository;
const chainsRepositoryMock = jest.mocked(chainsRepository);

const exchangeRepository = {
  getFiatCodes: jest.fn(),
} as unknown as IExchangeRepository;
const exchangeRepositoryMock = jest.mocked(exchangeRepository);

describe('BalancesService', () => {
  const service = new BalancesService(
    balancesRepositoryMock,
    chainsRepositoryMock,
    exchangeRepositoryMock,
  );

  it('should get ordered supported fiat codes', async () => {
    const fiatCodesResult = ['AED', 'AFN', 'EUR', 'ALL', 'USD'];
    exchangeRepositoryMock.getFiatCodes.mockResolvedValueOnce(fiatCodesResult);

    const res = await service.getSupportedFiatCodes();

    expect(res).toEqual(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    expect(exchangeRepositoryMock.getFiatCodes).toHaveBeenCalledTimes(1);
  });
});

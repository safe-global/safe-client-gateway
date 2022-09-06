import { BalancesService } from './balances.service';
import { IDomainRepository } from '../domain/domain.repository.interface';

const repository = {
  getFiatCodes: jest.fn(),
} as unknown as IDomainRepository;
const repositoryMock = jest.mocked(repository);

describe('BalancesService', () => {
  const service = new BalancesService(repositoryMock);

  it('should get ordered supported fiat codes', async () => {
    const fiatCodesResult = ['AED', 'AFN', 'EUR', 'ALL', 'USD'];
    repositoryMock.getFiatCodes.mockResolvedValueOnce(fiatCodesResult);

    const res = await service.getSupportedFiatCodes();

    expect(res).toEqual(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    expect(repositoryMock.getFiatCodes).toHaveBeenCalledTimes(1);
  });
});

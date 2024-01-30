import { IConfigurationService } from '@/config/configuration.service.interface';
import { BalancesApiManager } from '@/datasources/balances-api/balances-api.manager';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';

const configurationService = {
  getOrThrow: jest.fn(),
  get: jest.fn(),
} as IConfigurationService;

const configurationServiceMock = jest.mocked(configurationService);

const valkBalancesApi = {
  getBalances: jest.fn(),
  clearBalances: jest.fn(),
} as IBalancesApi;

const valkBalancesApiMock = jest.mocked(valkBalancesApi);

describe('Balances API Manager Tests', () => {
  describe('useExternalApi checks', () => {
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'features.valkBalancesChainIds') return ['1', '2', '3'];
    });

    it('should return true if the chain is included in the balance-externalized chains', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
      );
      expect(manager.useExternalApi('1')).toEqual(true);
    });

    it('should return false if the chain is included in the balance-externalized chains', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
      );
      expect(manager.useExternalApi('4')).toEqual(false);
    });
  });

  describe('getBalancesApi checks', () => {
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'features.valkBalancesChainIds') return ['1', '2', '3'];
    });

    it('should return the Valk API', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
      );
      expect(manager.getBalancesApi('2')).toEqual(valkBalancesApi);
    });

    it('should throw an error if no API is found for the input chainId', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
      );
      expect(() => manager.getBalancesApi('5')).toThrow();
    });
  });
});

import { IConfigurationService } from '@/config/configuration.service.interface';
import { BalancesApiManager } from '@/datasources/balances-api/balances-api.manager';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';

const configurationService = {
  getOrThrow: jest.fn(),
  get: jest.fn(),
} as IConfigurationService;

const configurationServiceMock = jest.mocked(configurationService);

const zerionBalancesApi = {
  getBalances: jest.fn(),
  clearBalances: jest.fn(),
  getCollectibles: jest.fn(),
  clearCollectibles: jest.fn(),
  getFiatCodes: jest.fn(),
} as IBalancesApi;

const zerionBalancesApiMock = jest.mocked(zerionBalancesApi);

beforeEach(() => {
  jest.resetAllMocks();
  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'features.zerionBalancesChainIds') return ['1', '2', '3'];
  });
});

describe('Balances API Manager Tests', () => {
  describe('useExternalApi checks', () => {
    it('should return true if the chain is included in the balance-externalized chains', () => {
      const manager = new BalancesApiManager(
        configurationService,
        zerionBalancesApiMock,
      );
      expect(manager.useExternalApi('1')).toEqual(true);
      expect(manager.useExternalApi('3')).toEqual(true);
    });

    it('should return false if the chain is included in the balance-externalized chains', () => {
      const manager = new BalancesApiManager(
        configurationService,
        zerionBalancesApiMock,
      );
      expect(manager.useExternalApi('4')).toEqual(false);
    });
  });

  describe('getBalancesApi checks', () => {
    it('should return the Zerion API', () => {
      const manager = new BalancesApiManager(
        configurationService,
        zerionBalancesApiMock,
      );
      expect(manager.getBalancesApi('2')).toEqual(zerionBalancesApi);
    });

    it('should throw an error if no API is found for the input chainId', () => {
      const manager = new BalancesApiManager(
        configurationService,
        zerionBalancesApiMock,
      );
      expect(() => manager.getBalancesApi('5')).toThrow();
    });
  });

  describe('getFiatCodes checks', () => {
    it('should return the intersection of all providers supported currencies', () => {
      zerionBalancesApiMock.getFiatCodes.mockReturnValue(['EUR', 'GBP', 'ETH']);
      const manager = new BalancesApiManager(
        configurationService,
        zerionBalancesApiMock,
      );

      expect(manager.getFiatCodes()).toStrictEqual(['ETH', 'EUR', 'GBP']);
    });
  });
});

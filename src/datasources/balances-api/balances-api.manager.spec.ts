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
  getFiatCodes: jest.fn(),
} as IBalancesApi;

const valkBalancesApiMock = jest.mocked(valkBalancesApi);

const zerionBalancesApi = {
  getBalances: jest.fn(),
  clearBalances: jest.fn(),
  getFiatCodes: jest.fn(),
} as IBalancesApi;

const zerionBalancesApiMock = jest.mocked(zerionBalancesApi);

beforeEach(() => {
  jest.resetAllMocks();
  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'features.valkBalancesChainIds') return ['1', '2', '3'];
    if (key === 'features.zerionBalancesChainIds') return ['4', '5', '6'];
  });
});

describe('Balances API Manager Tests', () => {
  describe('useExternalApi checks', () => {
    it('should return true if the chain is included in the balance-externalized chains', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
        zerionBalancesApiMock,
      );
      expect(manager.useExternalApi('1')).toEqual(true);
      expect(manager.useExternalApi('5')).toEqual(true);
    });

    it('should return false if the chain is included in the balance-externalized chains', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
        zerionBalancesApiMock,
      );
      expect(manager.useExternalApi('7')).toEqual(false);
    });
  });

  describe('getBalancesApi checks', () => {
    it('should return the Valk API', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
        zerionBalancesApiMock,
      );
      expect(manager.getBalancesApi('2')).toEqual(valkBalancesApi);
    });

    it('should return the Zerion API', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
        zerionBalancesApiMock,
      );
      expect(manager.getBalancesApi('6')).toEqual(zerionBalancesApi);
    });

    it('should throw an error if no API is found for the input chainId', () => {
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
        zerionBalancesApiMock,
      );
      expect(() => manager.getBalancesApi('100')).toThrow();
    });
  });

  describe('getFiatCodes checks', () => {
    it('should return the intersection of all providers supported currencies', () => {
      valkBalancesApiMock.getFiatCodes.mockReturnValue([
        'USD',
        'BTC',
        'EUR',
        'ETH',
      ]);
      zerionBalancesApiMock.getFiatCodes.mockReturnValue(['EUR', 'GBP', 'ETH']);
      const manager = new BalancesApiManager(
        configurationService,
        valkBalancesApiMock,
        zerionBalancesApiMock,
      );

      expect(manager.getFiatCodes()).toStrictEqual(['ETH', 'EUR']);
    });
  });
});

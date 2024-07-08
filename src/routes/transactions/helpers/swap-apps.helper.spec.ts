import { IConfigurationService } from '@/config/configuration.service.interface';
import { fullAppDataBuilder } from '@/domain/swaps/entities/__tests__/full-app-data.builder';
import { SwapAppsHelper } from '@/routes/transactions/helpers/swap-apps.helper';

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const configurationServiceMock = jest.mocked(configurationService);

describe('SwapAppsHelper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Restricting disabled', () => {
    beforeEach(() => {
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'swaps.restrictApps') return false;
        throw new Error(`Key ${key} not found.`);
      });
    });

    it('should return true if restriction is disabled', () => {
      const allowedApps = new Set<string>(['69', '420']);
      const target = new SwapAppsHelper(configurationServiceMock, allowedApps);
      const fullAppData = fullAppDataBuilder()
        .with('fullAppData', {
          appCode: '1337', // Not allowed
        })
        .build();

      const result = target.isAppAllowed(fullAppData);

      expect(result).toBe(true);
    });
  });

  describe('Restricting enabled', () => {
    beforeEach(() => {
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'swaps.restrictApps') return true;
        throw new Error(`Key ${key} not found.`);
      });
    });

    it('should return true if the app is allowed', () => {
      const allowedApps = new Set<string>(['69', '420']);
      const target = new SwapAppsHelper(configurationServiceMock, allowedApps);
      const fullAppData = fullAppDataBuilder()
        .with('fullAppData', {
          appCode: '69', // Allowed
        })
        .build();

      const result = target.isAppAllowed(fullAppData);

      expect(result).toBe(true);
    });

    it('should return false if the app is not allowed', () => {
      const allowedApps = new Set<string>(['69', '420']);
      const target = new SwapAppsHelper(configurationServiceMock, allowedApps);
      const fullAppData = fullAppDataBuilder()
        .with('fullAppData', {
          appCode: '1337', // Not allowed
        })
        .build();

      const result = target.isAppAllowed(fullAppData);

      expect(result).toBe(false);
    });

    it('should return false if there is no appCode', () => {
      const allowedApps = new Set<string>(['69', '420']);
      const target = new SwapAppsHelper(configurationServiceMock, allowedApps);
      const fullAppData = fullAppDataBuilder()
        .with('fullAppData', {
          differing: 'fullAppData', // No appCode
        })
        .build();

      const result = target.isAppAllowed(fullAppData);

      expect(result).toBe(false);
    });
  });
});

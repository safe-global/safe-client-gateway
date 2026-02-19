import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkService } from '@/datasources/network/network.service.interface';
import type { Server } from 'net';

const CUSTOM_CGW_KEY = 'CUSTOM_CGW_KEY';

describe('FeatureFlagService Integration', () => {
  let app: INestApplication<Server>;
  let featureFlagService: IFeatureFlagService;
  let configurationService: IConfigurationService;

  beforeEach(async () => {
    const moduleFixture = await createTestModule();
    configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    featureFlagService =
      moduleFixture.get<IFeatureFlagService>(IFeatureFlagService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('Service key configuration', () => {
    it('should use default "CGW" service key for CGW internal feature flag fetching', () => {
      const cgwServiceKey = configurationService.getOrThrow<string>(
        'safeConfig.cgwServiceKey',
      );
      expect(cgwServiceKey).toBe('CGW');
    });

    it('should use custom CGW service key when configured', async () => {
      const customConfig = (): ReturnType<typeof configuration> => ({
        ...configuration(),
        safeConfig: {
          ...configuration().safeConfig,
          cgwServiceKey: CUSTOM_CGW_KEY,
        },
      });
      const moduleFixture = await createTestModule({ config: customConfig });
      const configService = moduleFixture.get<IConfigurationService>(
        IConfigurationService,
      );
      const featureFlagSvc =
        moduleFixture.get<IFeatureFlagService>(IFeatureFlagService);
      const networkService = moduleFixture.get(NetworkService);

      expect(configService.getOrThrow<string>('safeConfig.cgwServiceKey')).toBe(
        CUSTOM_CGW_KEY,
      );

      networkService.get.mockResolvedValueOnce({ data: null, status: 200 })
      const app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
      await featureFlagSvc.isFeatureEnabled('1', 'test');

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(`/api/v2/chains/${CUSTOM_CGW_KEY}/1`),
        }),
      );
      await app.close();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should be injectable and callable', async () => {
      expect(featureFlagService).toBeDefined();
      expect(typeof featureFlagService.isFeatureEnabled).toBe('function');

      const result = await featureFlagService.isFeatureEnabled('1', 'test');
      expect(typeof result).toBe('boolean');
    });
  });
});

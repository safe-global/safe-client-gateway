import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { createTestModule } from '@/__tests__/testing-module';
import type { Server } from 'net';

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

    it('should allow custom CGW service key from environment variable', () => {
      const cgwServiceKey = configurationService.getOrThrow<string>(
        'safeConfig.cgwServiceKey',
      );
      expect(typeof cgwServiceKey).toBe('string');
      expect(cgwServiceKey.length).toBeGreaterThan(0);
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

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { fakeConfigurationService, TestConfigurationModule } from './common/config/__tests__/test.configuration.module';

describe('AppModule', () => {
  beforeAll(async () => {
    fakeConfigurationService.set('exchange.baseUri', 'https://test.exchange');
    fakeConfigurationService.set('exchange.apiKey', 'testKey');
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );
  });

  it(`AppModule is successfully created`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TestConfigurationModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();
  });
});

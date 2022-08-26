import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { TestConfigurationModule } from './common/config/__tests__/test.configuration.module';

describe('AppModule', () => {
  it(`AppModule is successfully created`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TestConfigurationModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();
  });
});

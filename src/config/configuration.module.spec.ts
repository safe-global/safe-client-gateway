import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationModule } from '@/config/configuration.module';

describe('ConfigurationModule', () => {
  it(`ConfigurationModule is successfully created`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigurationModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();
  });
});

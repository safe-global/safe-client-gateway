import { Test, TestingModule } from '@nestjs/testing';
import { AppModule, configurationModule } from './app.module';
import * as request from 'supertest';
import { Controller, Get } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { ClsService } from 'nestjs-cls';
import { faker } from '@faker-js/faker';

@Controller({ path: 'test' })
class TestController {
  constructor(private readonly cls: ClsService) {}

  @Get()
  getTest() {
    return this.cls.get('safeAppUserAgent');
  }
}

describe('Application Module (Unit Tests)', () => {
  it('Safe-App-User-Agent is correctly registered in Cls', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(configurationModule)
      .useModule(ConfigurationModule.register(configuration))
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
    const userAgent = faker.word.sample();

    await request(app.getHttpServer())
      .get(`/test`)
      .set('Safe-App-User-Agent', userAgent)
      .expect(200)
      .expect(userAgent);

    await app.close();
  });
});

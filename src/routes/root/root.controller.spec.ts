import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule, configurationModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { ConfigurationModule } from '@/config/configuration.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import * as request from 'supertest';
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { TestEmailDatasourceModule } from '@/datasources/email/__tests__/test.email.datasource.module';

describe('Root Controller tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(EmailDataSourceModule)
      .useModule(TestEmailDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(configurationModule)
      .useModule(ConfigurationModule.register(configuration))
      .compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  it('should redirect / to /index.html', async () => {
    await request(app.getHttpServer())
      .get(`/`)
      .expect(302)
      .expect((res) => {
        expect(res.get('location')).toBe('/index.html');
      });
  });
});

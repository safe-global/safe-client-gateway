import { Test, TestingModule } from '@nestjs/testing';
import { NetworkModule } from './network.module';
import { RequestScopedLoggingModule } from '../../logging/logging.module';
import { ClsModule } from 'nestjs-cls';
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';

describe('NetworkModule', () => {
  it(`axios client is created with timeout`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NetworkModule,
        // The following imports are required by the Network Module
        // and should be provided in the production app for it to work
        ClsModule.forRoot({ global: true }),
        RequestScopedLoggingModule,
        ConfigurationModule.register(configuration),
      ],
    }).compile();
    const app = moduleFixture.createNestApplication();
    const axios = moduleFixture.get('AxiosClient');
    const configurationService = moduleFixture.get(IConfigurationService);
    const httpClientTimeout = configurationService.get(
      'httpClient.requestTimeout',
    );
    await app.init();

    expect(axios.defaults.timeout).toBe(httpClientTimeout);

    await app.close();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NetworkModule } from './network.module';
import { RequestScopedLoggingModule } from '../../logging/logging.module';
import { ClsModule } from 'nestjs-cls';

describe('NetworkModule', () => {
  it(`NetworkModule is successfully created`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NetworkModule,
        // The following imports are required by the Network Module
        // and should be provided in the production app for it to work
        ClsModule.forRoot({ global: true }),
        RequestScopedLoggingModule,
      ],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();
  });
});

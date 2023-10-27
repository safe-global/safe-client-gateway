import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { alertBuilder } from '@/routes/alerts/entities/__tests__/alerts.builder';
import { EventType } from '@/routes/alerts/entities/alert.dto.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

describe.skip('Alerts (Unit)', () => {
  let app: INestApplication;
  let loggingService: ILoggingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    app = moduleFixture.createNestApplication();
    loggingService = moduleFixture.get(LoggingService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('notifies about addOwnerWithThreshold attempts', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const alert = {
      id: 'fd719009-0df5-442a-b395-cbb072006628',
      event_type: 'ALERT',
      transaction: {
        network: '5',
        block_hash:
          '0x285a52c5467924b17ec5d2ded9f64b0f9d6f67d516ca20d3bcbd42096881aaf4',
        block_number: 9927613,
        hash: '0x85d8e3ebe92ef2840251981ec46ad34251387b5197dd9704b6a7b6341aec4d7e',
        from: '0x3326c5D84bd462Ec1CadA0B5bBa9b2B85059FCba',
        to: '0x791e70F698C187E3EdCff0CE9Ccd23215AfF85c9',
        logs: [
          {
            address: '0x791e70F698C187E3EdCff0CE9Ccd23215AfF85c9',
            topics: [
              '0x4c8a9c748e976c17c2eb2c2bc50da76eac9cd90ff529f0fe900e0c10a179f031',
              '0x0000000000000000000000000000000000000000000000000000000000000003',
              '0x1aecc7e249b33caa5731f8edd73cf3326920cc5c83c6c43c52ec195c835450f7',
            ],
            data: '0x0000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
          },
        ],
        input:
          '0x468721a70000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
        value: '0x0',
        nonce: '0x15',
        gas: '0x15033',
        gas_used: '0x14ca2',
        cumulative_gas_used: '0x287308',
        gas_price: '0x59682ff4',
        gas_tip_cap: '0x59682f00',
        gas_fee_cap: '0x5968305b',
      },
    };

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(200);

    expect(consoleSpy).toBeCalledTimes(1);
    expect(consoleSpy).toBeCalledWith(
      '0x8ebF8bbDf773164daC313Ea2DeB103FF71B04Fd5',
      '0x3326c5D84bd462Ec1CadA0B5bBa9b2B85059FCba',
      BigInt(1),
    );
  });

  // TODO: Create more transactions via PoC to test this
  it.todo('notifies about non-addOwnerWithThreshold attempts');

  it('handles alerts with multiple logs', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const alert = {
      id: 'fd719009-0df5-442a-b395-cbb072006628',
      event_type: 'ALERT',
      transaction: {
        network: '5',
        block_hash:
          '0x285a52c5467924b17ec5d2ded9f64b0f9d6f67d516ca20d3bcbd42096881aaf4',
        block_number: 9927613,
        hash: '0x85d8e3ebe92ef2840251981ec46ad34251387b5197dd9704b6a7b6341aec4d7e',
        from: '0x3326c5D84bd462Ec1CadA0B5bBa9b2B85059FCba',
        to: '0x791e70F698C187E3EdCff0CE9Ccd23215AfF85c9',
        logs: [
          {
            address: '0x791e70F698C187E3EdCff0CE9Ccd23215AfF85c9',
            topics: [
              '0x4c8a9c748e976c17c2eb2c2bc50da76eac9cd90ff529f0fe900e0c10a179f031',
              '0x0000000000000000000000000000000000000000000000000000000000000003',
              '0x1aecc7e249b33caa5731f8edd73cf3326920cc5c83c6c43c52ec195c835450f7',
            ],
            data: '0x0000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
          },
          {
            address: '0x791e70F698C187E3EdCff0CE9Ccd23215AfF85c9',
            topics: [
              '0x4c8a9c748e976c17c2eb2c2bc50da76eac9cd90ff529f0fe900e0c10a179f031',
              '0x0000000000000000000000000000000000000000000000000000000000000003',
              '0x1aecc7e249b33caa5731f8edd73cf3326920cc5c83c6c43c52ec195c835450f7',
            ],
            data: '0x0000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
          },
          {
            address: '0x791e70F698C187E3EdCff0CE9Ccd23215AfF85c9',
            topics: [
              '0x4c8a9c748e976c17c2eb2c2bc50da76eac9cd90ff529f0fe900e0c10a179f031',
              '0x0000000000000000000000000000000000000000000000000000000000000003',
              '0x1aecc7e249b33caa5731f8edd73cf3326920cc5c83c6c43c52ec195c835450f7',
            ],
            data: '0x0000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
          },
        ],
        input:
          '0x468721a70000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
        value: '0x0',
        nonce: '0x15',
        gas: '0x15033',
        gas_used: '0x14ca2',
        cumulative_gas_used: '0x287308',
        gas_price: '0x59682ff4',
        gas_tip_cap: '0x59682f00',
        gas_fee_cap: '0x5968305b',
      },
    };

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(200);

    expect(consoleSpy).toBeCalledTimes(3);
    expect(consoleSpy).toBeCalledWith(
      '0x8ebF8bbDf773164daC313Ea2DeB103FF71B04Fd5',
      '0x3326c5D84bd462Ec1CadA0B5bBa9b2B85059FCba',
      BigInt(1),
    );
    expect(consoleSpy).toBeCalledWith(
      '0x8ebF8bbDf773164daC313Ea2DeB103FF71B04Fd5',
      '0x3326c5D84bd462Ec1CadA0B5bBa9b2B85059FCba',
      BigInt(1),
    );
    expect(consoleSpy).toBeCalledWith(
      '0x8ebF8bbDf773164daC313Ea2DeB103FF71B04Fd5',
      '0x3326c5D84bd462Ec1CadA0B5bBa9b2B85059FCba',
      BigInt(1),
    );
  });

  it('logs unknown alerts', async () => {
    const warnSpy = jest.spyOn(loggingService, 'warn');

    const alert = alertBuilder().with('event_type', EventType.ALERT).build();

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(200);

    expect(warnSpy).toHaveBeenCalledWith('Unknown alert received');
  });

  it('logs test events', async () => {
    const debugSpy = jest.spyOn(loggingService, 'debug');

    const alert = alertBuilder().with('event_type', EventType.TEST).build();

    await request(app.getHttpServer()).post('/alerts').send(alert).expect(200);

    expect(debugSpy).toHaveBeenCalledWith('Test alert received');
  });

  it('returns 400 (Bad Request) for invalid payload', async () => {
    const data = {};

    await request(app.getHttpServer()).post('/alerts').send(data).expect(400);
  });
});

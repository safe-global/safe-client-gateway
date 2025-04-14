import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { transactionDataDtoBuilder } from '@/routes/data-decode/entities/__tests__/transaction-data.dto.builder';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import type { Server } from 'net';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';

describe('Data decode e2e tests', () => {
  let app: INestApplication<Server>;
  const chainId = '1'; // Mainnet

  beforeAll(async () => {
    const cacheKeyPrefix = crypto.randomUUID();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /data-decoder', async () => {
    const getDataDecodedDto = transactionDataDtoBuilder()
      .with(
        'data',
        '0x0d582f130000000000000000000000001b9a0da11a5cace4e7035993cbb2e4b1b3b164cf0000000000000000000000000000000000000000000000000000000000000001',
      )
      .with('to', '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761')
      .build();
    const expectedResponse: DataDecoded = {
      method: 'addOwnerWithThreshold',
      parameters: [
        {
          name: 'owner',
          type: 'address',
          value: '0x1b9a0DA11a5caCE4e7035993Cbb2E4B1B3b164Cf',
          valueDecoded: null,
        },
        { name: '_threshold', type: 'uint256', value: '1', valueDecoded: null },
      ],
      accuracy: 'FULL_MATCH',
    };

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send(getDataDecodedDto)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });
  });

  it('POST /data-decoder should throw a validation error', async () => {
    const getDataDecodedDto = transactionDataDtoBuilder().build();

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send({ ...getDataDecodedDto, to: faker.number.int() })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['to'],
        message: 'Expected string, received number',
      });
  });

  it('POST /data-decoder should throw a validation error (2)', async () => {
    const getDataDecodedDto = transactionDataDtoBuilder().build();

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send({ ...getDataDecodedDto, to: faker.string.alphanumeric() })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'custom',
        path: ['to'],
        message: 'Invalid address',
      });
  });
});

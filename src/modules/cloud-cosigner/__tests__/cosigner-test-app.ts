// SPDX-License-Identifier: FSL-1.1-MIT
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import {
  Test,
  type TestingModule,
  type TestingModuleBuilder,
} from '@nestjs/testing';
import type postgres from 'postgres';
import { TestDbFactory } from '@/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import configuration from '@/config/entities/__tests__/configuration';
import { TestBlocklistModule } from '@/config/entities/__tests__/test.blocklist.module';
import { BlocklistModule } from '@/config/entities/blocklist.module';
import { CosignerAppModule } from '@/cosigner-app.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestTxAuthNetworkModule } from '@/datasources/network/__tests__/test.tx-auth.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestQueuesApiModule } from '@/modules/queues/datasources/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';

export type CosignerTestApp = {
  app: INestApplication<Server>;
  moduleFixture: TestingModule;
  configuration: ReturnType<typeof configuration>;
  destroy: () => Promise<void>;
};

/**
 * Boots the cosigner deployable's own root module — not the gateway's
 * `AppModule` — against a freshly created, migrated database, with the same
 * infrastructure doubles the gateway's integration specs use. BullMQ still
 * talks to the local Redis, so the review worker runs for real.
 */
export async function bootCosignerTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<CosignerTestApp> {
  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  const testDatabase: postgres.Sql =
    await testDbFactory.createTestDatabase(testDatabaseName);

  const defaultConfiguration = configuration();
  const testConfiguration = (): typeof defaultConfiguration => ({
    ...defaultConfiguration,
    db: {
      ...defaultConfiguration.db,
      connection: {
        ...defaultConfiguration.db.connection,
        postgres: {
          ...defaultConfiguration.db.connection.postgres,
          database: testDatabaseName,
        },
      },
    },
  });

  const builder = Test.createTestingModule({
    imports: [CosignerAppModule.register(testConfiguration)],
  })
    .overrideProvider(CacheKeyPrefix)
    .useValue(randomUUID())
    .overrideModule(PostgresDatabaseModule)
    .useModule(TestPostgresDatabaseModule)
    .overrideModule(QueuesApiModule)
    .useModule(TestQueuesApiModule)
    .overrideModule(BlocklistModule)
    .useModule(TestBlocklistModule)
    .overrideModule(CacheModule)
    .useModule(TestCacheModule)
    .overrideModule(RequestScopedLoggingModule)
    .useModule(TestLoggingModule)
    .overrideModule(NetworkModule)
    .useModule(TestNetworkModule)
    .overrideModule(TxAuthNetworkModule)
    .useModule(TestTxAuthNetworkModule);

  const moduleFixture = await customize(builder).compile();
  const app = await new TestAppProvider().provide(moduleFixture);
  await initTestApplication(app);

  return {
    app,
    moduleFixture,
    configuration: defaultConfiguration,
    destroy: async (): Promise<void> => {
      await app.close();
      await testDbFactory.destroyTestDatabase(testDatabase);
    },
  };
}

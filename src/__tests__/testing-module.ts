import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { TestQueuesApiModule } from '@/modules/queues/datasources/__tests__/test.queues-api.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TargetedMessagingDatasourceModule } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource.module';
import { TestTargetedMessagingDatasourceModule } from '@/modules/targeted-messaging/datasources/__tests__/test.targeted-messaging.datasource.module';
import type { ModuleDefinition } from '@nestjs/core/interfaces/module-definition.interface';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import type { Provider } from '@nestjs/common';
import { CsvExportModule } from '@/modules/csv-export/csv-export.module';
import { TestCsvExportModule } from '@/modules/csv-export/v1/__tests__/test.csv-export.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import { TestTxAuthNetworkModule } from '@/datasources/network/__tests__/test.tx-auth.network.module';
import type { Address } from 'viem';
import { IBlocklistService } from '@/config/entities/blocklist.interface';

// Create a mock blocklist service for tests
const testBlocklistService: IBlocklistService = {
  getBlocklist(): Array<Address> {
    return [];
  },
  clearCache(): void {
    // No-op in tests
  },
};

export interface CreateBaseTestModuleOptions {
  config?: typeof configuration;
  overridePostgresV2?: boolean;
  cacheKeyPrefix?: string;
  modules?: Array<ModuleOverride>;
  providers?: Array<Provider>;
  guards?: Array<GuardOverride>;
}

export interface ModuleOverride {
  originalModule: ModuleDefinition;
  testModule: ModuleDefinition;
}

export interface GuardOverride {
  originalGuard: unknown;
  testGuard: unknown;
}

export async function createTestModule(
  options: CreateBaseTestModuleOptions = {},
): Promise<TestingModule> {
  const {
    config,
    cacheKeyPrefix,
    overridePostgresV2,
    modules: additionalOverrides = [],
    guards: guards = [],
    providers = [],
  } = options;

  return createBaseTestModule({
    config,
    overridePostgresV2,
    cacheKeyPrefix,
    guards,
    providers,
    modules: [
      {
        originalModule: CacheModule,
        testModule: TestCacheModule,
      },
      {
        originalModule: RequestScopedLoggingModule,
        testModule: TestLoggingModule,
      },
      {
        originalModule: NetworkModule,
        testModule: TestNetworkModule,
      },
      {
        originalModule: TxAuthNetworkModule,
        testModule: TestTxAuthNetworkModule,
      },
      ...additionalOverrides,
    ],
  });
}

export async function createBaseTestModule(
  options: CreateBaseTestModuleOptions = {},
): Promise<TestingModule> {
  const {
    config = configuration,
    overridePostgresV2 = true, // Enable Postgres V2 by default
    cacheKeyPrefix = crypto.randomUUID(),
    modules: additionalOverrides = [],
    guards: guards = [],
    providers = [],
  } = options;

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule.register(config)],
    providers: providers,
  })
    .overrideProvider(CacheKeyPrefix)
    .useValue(cacheKeyPrefix)
    .overrideProvider(IBlocklistService)
    .useValue(testBlocklistService)
    .overrideModule(PostgresDatabaseModule)
    .useModule(TestPostgresDatabaseModule)
    .overrideModule(TargetedMessagingDatasourceModule)
    .useModule(TestTargetedMessagingDatasourceModule)
    .overrideModule(QueuesApiModule)
    .useModule(TestQueuesApiModule)
    .overrideModule(CsvExportModule)
    .useModule(TestCsvExportModule);

  if (overridePostgresV2) {
    moduleBuilder
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2);
  }

  for (const guard of guards) {
    moduleBuilder.overrideGuard(guard.originalGuard).useValue(guard.testGuard);
  }

  // Apply additional overrides
  for (const override of additionalOverrides) {
    moduleBuilder
      .overrideModule(override.originalModule)
      .useModule(override.testModule);
  }

  return moduleBuilder.compile();
}

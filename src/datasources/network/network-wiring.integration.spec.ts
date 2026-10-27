// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ModulesContainer } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { TestingModule } from '@nestjs/testing';
import { createTestModule } from '#/__tests__/testing-module';
import configuration from '#/config/entities/__tests__/configuration';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { TestNetworkModule } from '#/datasources/network/__tests__/test.network.module';
import { TestSafeInternalNetworkModule } from '#/datasources/network/__tests__/test.safe-internal.network.module';
import { TestTxAuthNetworkModule } from '#/datasources/network/__tests__/test.tx-auth.network.module';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { TestSafeQueueModule } from '#/modules/safe-queue/__tests__/test.safe-queue.module';

/**
 * Test network modules share one {@link NetworkService} mock, so this inspects
 * the DI graph: module-scoped NetworkServices must only reach Safe services.
 */
describe('NetworkService wiring', () => {
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    // Load feature-gated modules so their datasources are in the graph
    const testConfiguration = (): ReturnType<typeof configuration> => {
      const defaultConfiguration = configuration();
      return {
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          billingService: true,
        },
        billing: {
          ...defaultConfiguration.billing,
          webhook: {
            ...defaultConfiguration.billing.webhook,
            publicKey: faker.string.alphanumeric(),
          },
        },
      };
    };

    moduleFixture = await createTestModule({ config: testConfiguration });
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  /**
   * Pairs each provider depending on a {@link NetworkService}, directly or
   * through {@link CacheFirstDataSource}, with the module hosting it.
   */
  function getNetworkConsumers(): Array<{
    provider: string | undefined;
    networkModule: unknown;
  }> {
    const modules = moduleFixture.get(ModulesContainer, { strict: false });

    return [...modules.values()]
      .flatMap((module) => [...module.providers.values()])
      .filter((wrapper) => wrapper.metatype !== CacheFirstDataSource)
      .flatMap((wrapper) => {
        return getNetworkModules(wrapper).map((networkModule) => ({
          provider: wrapper.metatype?.name,
          networkModule,
        }));
      });
  }

  function getNetworkModules(wrapper: InstanceWrapper): Array<unknown> {
    // Undefined at runtime for providers without constructor dependencies
    const dependencies: Array<InstanceWrapper> | undefined =
      wrapper.getCtorMetadata();

    return (dependencies ?? []).flatMap((dependency) => {
      if (dependency.token === NetworkService) {
        return [dependency.host?.metatype];
      }
      if (dependency.token === CacheFirstDataSource) {
        return getNetworkModules(dependency);
      }
      return [];
    });
  }

  it('only wires Safe-service clients to a module-scoped NetworkService', () => {
    const moduleScopedConsumers = getNetworkConsumers()
      .filter(({ networkModule }) => {
        return (
          networkModule === TestTxAuthNetworkModule ||
          networkModule === TestSafeQueueModule ||
          networkModule === TestSafeInternalNetworkModule
        );
      })
      .map(({ provider }) => provider);

    // A provider added to a module importing a module-scoped NetworkService
    // lands here: only add it if it calls a Safe service.
    expect(new Set(moduleScopedConsumers)).toEqual(
      new Set([
        'BalancesApiManager',
        'BillingApi',
        'ConfigApi',
        'DataDecoderApi',
        'FeeServiceApi',
        'LockingApi',
        'PolicyIndexerApi',
        'SafeQueueService',
        'TransactionApiManager',
      ]),
    );
  });

  it.each(['CoingeckoApi', 'ZerionWalletPortfolioApi'])(
    'wires %s to the global NetworkService only',
    (providerName) => {
      const networkModules = getNetworkConsumers()
        .filter(({ provider }) => provider === providerName)
        .map(({ networkModule }) => networkModule);

      expect(new Set(networkModules)).toEqual(new Set([TestNetworkModule]));
    },
  );
});

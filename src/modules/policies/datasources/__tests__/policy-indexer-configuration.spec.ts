// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import configuration from '@/config/entities/configuration';
import { RootConfigurationSchema } from '@/config/entities/schemas/configuration.schema';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';

const mockNetworkService = { post: vi.fn() } as MockedObject<INetworkService>;
const mockCacheService = {} as MockedObject<ICacheService>;
const mockLoggingService = {} as MockedObject<ILoggingService>;

/**
 * The Policy Indexer is optional infrastructure: a deployment that does not run
 * one leaves `POLICY_INDEXER_BASE_URI` unset, which is why `.env.sample.json`
 * gives it no default. Booting is what must not depend on it - the client reads
 * its base URI with `getOrThrow` in the constructor, so a missing key would take
 * the whole app down rather than the one route that needs it.
 */
describe('Policy Indexer configuration', () => {
  const withoutBaseUri = <T>(run: () => T): T => {
    const previous = process.env.POLICY_INDEXER_BASE_URI;
    delete process.env.POLICY_INDEXER_BASE_URI;
    try {
      return run();
    } finally {
      if (previous !== undefined) {
        process.env.POLICY_INDEXER_BASE_URI = previous;
      }
    }
  };

  it('should validate an environment that does not set it', () => {
    const result = withoutBaseUri(() =>
      RootConfigurationSchema.safeParse(process.env),
    );

    const issue = result.success
      ? undefined
      : result.error.issues.find(
          (entry) => entry.path[0] === 'POLICY_INDEXER_BASE_URI',
        );
    expect(issue).toBeUndefined();
  });

  it('should still resolve a base URI, so construction does not throw', () => {
    const config = withoutBaseUri(() => configuration());

    expect(config.policies.indexer.baseUri).not.toBe('');
  });

  it('should construct the client without the variable set', () => {
    const config = withoutBaseUri(() => configuration());
    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'policies.indexer.baseUri',
      config.policies.indexer.baseUri,
    );
    configurationService.set(
      'expirationTimeInSeconds.policyIndexer',
      config.expirationTimeInSeconds.policyIndexer,
    );

    expect(
      () =>
        new PolicyIndexerApi(
          configurationService,
          mockNetworkService,
          mockCacheService,
          mockLoggingService,
          new HttpErrorFactory(),
        ),
    ).not.toThrow();
  });
});

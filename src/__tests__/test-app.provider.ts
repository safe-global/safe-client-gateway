// SPDX-License-Identifier: FSL-1.1-MIT
import type { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { TestingModule } from '@nestjs/testing';
import {
  configureShutdownHooks,
  configureVersioning,
  createFastifyAdapter,
  DEFAULT_CONFIGURATION,
  FASTIFY_ROUTER_OPTIONS,
} from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';

export type TestApplication = NestFastifyApplication;

export function createTestApplication(module: TestingModule): TestApplication {
  const app = module.createNestApplication<NestFastifyApplication>(
    // Match production route matching (trailing slash + long composite ids) so
    // tests don't pass against behaviour the deployed app never exhibits.
    // trustProxy/bodyLimit are intentionally left at Fastify defaults: this
    // lightweight helper has no guaranteed configuration service, and those
    // settings don't affect routing.
    new FastifyAdapter({ routerOptions: FASTIFY_ROUTER_OPTIONS }),
  );
  // The controllers are URI-versioned, so versioning must be enabled or
  // version-paired controllers (e.g. v1/v2 `/chains`) collide on the same path
  // under Fastify, which—unlike Express—rejects duplicate route registration.
  configureVersioning(app);
  return app;
}

/**
 * Initializes a test {@link INestApplication} and waits for the underlying
 * Fastify instance to be ready.
 *
 * Always use this instead of a bare `app.init()`: Fastify attaches route
 * lifecycle hooks only once `.ready()` resolves, so a request sent after
 * `init()` alone races app boot and crashes inside Fastify's hook runner,
 * hanging the test until timeout.
 */
export async function initTestApplication(
  app: INestApplication,
): Promise<void> {
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
}

/**
 * Provides a configured test {@link INestApplication} from a
 * {@link TestingModule}.
 *
 * The same configuration steps as production are applied, except shutdown
 * hooks: they are not required in tests and enabling them might result in a
 * MaxListenersExceededWarning as the number of listeners exceeds the default.
 *
 * Throws if used outside of a testing environment.
 */
export class TestAppProvider {
  private readonly configuration = DEFAULT_CONFIGURATION.filter(
    (config) => config !== configureShutdownHooks,
  );

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      throw Error('TestAppProvider used outside of a testing environment');
    }
  }

  public async provide(module: TestingModule): Promise<INestApplication> {
    const configurationService = module.get<IConfigurationService>(
      IConfigurationService,
      { strict: false },
    );
    const app = module.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(configurationService),
    );
    for (const configure of this.configuration) {
      await configure(app);
    }
    return app;
  }
}

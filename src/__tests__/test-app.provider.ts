// SPDX-License-Identifier: FSL-1.1-MIT
import type { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { TestingModule } from '@nestjs/testing';
import {
  configureShutdownHooks,
  createFastifyAdapter,
  DEFAULT_CONFIGURATION,
} from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';

export type TestApplication = NestFastifyApplication;

export function createTestApplication(module: TestingModule): TestApplication {
  return module.createNestApplication(
    new FastifyAdapter(),
  ) as NestFastifyApplication;
}

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

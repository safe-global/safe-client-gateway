// SPDX-License-Identifier: FSL-1.1-MIT
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module';
import {
  createFastifyAdapterFromConfiguration,
  DEFAULT_CONFIGURATION,
} from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';

async function bootstrap(): Promise<void> {
  // The Fastify adapter needs `trustProxy`/`bodyLimit` at construction time,
  // before the DI container exists, so the raw configuration is read directly.
  const appConfiguration = configuration();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(),
    createFastifyAdapterFromConfiguration(appConfiguration.express),
  );

  for (const configure of DEFAULT_CONFIGURATION) {
    await configure(app);
  }

  const configurationService: IConfigurationService =
    app.get<IConfigurationService>(IConfigurationService);
  const applicationPort: string =
    configurationService.getOrThrow('application.port');
  const applicationHost: string =
    configurationService.getOrThrow('application.host');

  if (
    configurationService.getOrThrow('application.allowCors') &&
    configurationService.getOrThrow('application.isDevelopment')
  ) {
    app.enableCors({ origin: true, credentials: true });
  }

  await app.listen(applicationPort, applicationHost);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});

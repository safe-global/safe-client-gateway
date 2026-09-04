// SPDX-License-Identifier: FSL-1.1-MIT
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  createFastifyAdapterFromConfiguration,
  DEFAULT_CONFIGURATION,
} from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { CosignerAppModule } from '@/cosigner-app.module';

/**
 * Entry point of the cloud cosigner deployable. Same container image as the
 * gateway, started with `node dist/src/cosigner.main.js` and its own
 * environment (notably `FF_CLOUD_COSIGNER`, `AMQP_QUEUE` and the signer key).
 */
async function bootstrap(): Promise<void> {
  const appConfiguration = configuration();
  const app = await NestFactory.create<NestFastifyApplication>(
    CosignerAppModule.register(),
    createFastifyAdapterFromConfiguration(appConfiguration.express),
  );

  for (const configure of DEFAULT_CONFIGURATION) {
    await configure(app);
  }

  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );
  const applicationPort: string =
    configurationService.getOrThrow('application.port');
  const applicationHost: string =
    configurationService.getOrThrow('application.host');

  if (
    configurationService.getOrThrow('application.allowCors') &&
    configurationService.getOrThrow('application.isDevelopment')
  ) {
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
  }

  await app.listen(applicationPort, applicationHost);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to bootstrap cloud cosigner', error);
  process.exit(1);
});

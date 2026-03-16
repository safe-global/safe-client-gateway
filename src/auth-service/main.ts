// SPDX-License-Identifier: FSL-1.1-MIT
import { AuthAppModule } from '@/auth-service/app.module';
import { AuthAppProvider } from '@/auth-service/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';

async function bootstrap(): Promise<void> {
  const app = await new AuthAppProvider().provide(AuthAppModule.register());

  const configurationService: IConfigurationService =
    app.get<IConfigurationService>(IConfigurationService);

  // Auth service uses its own port (defaults to 3001)
  const applicationPort: string =
    configurationService.get('auth.service.port') ?? '3001';

  if (
    configurationService.getOrThrow('application.allowCors') &&
    configurationService.getOrThrow('application.isDevelopment')
  ) {
    app.enableCors();
  }

  await app.listen(applicationPort);
}

void bootstrap();

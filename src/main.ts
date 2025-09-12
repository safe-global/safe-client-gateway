import { AppModule } from '@/app.module';
import { DefaultAppProvider } from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';

async function bootstrap(): Promise<void> {
  const app = await new DefaultAppProvider().provide(AppModule.register());

  const configurationService: IConfigurationService =
    app.get<IConfigurationService>(IConfigurationService);
  const applicationPort: string =
    configurationService.getOrThrow('application.port');

  if (
    configurationService.getOrThrow('application.allowCors') &&
    configurationService.getOrThrow('application.isDevelopment')
  ) {
    app.enableCors();
  }

  await app.listen(applicationPort);
}

void bootstrap();

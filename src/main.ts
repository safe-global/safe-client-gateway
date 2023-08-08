import { AppModule } from './app.module';
import { IConfigurationService } from './config/configuration.service.interface';
import { DefaultAppProvider } from './app.provider';

async function bootstrap() {
  const app = await new DefaultAppProvider().provide(AppModule);

  app.enableCors();

  const configurationService: IConfigurationService =
    app.get<IConfigurationService>(IConfigurationService);
  const applicationPort: string =
    configurationService.getOrThrow('applicationPort');
  await app.listen(applicationPort);
}

bootstrap();

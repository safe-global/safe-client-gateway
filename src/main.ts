import { AppModule } from '@/app.module';
import { DefaultAppProvider } from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';

async function bootstrap(): Promise<void> {
  const app = await new DefaultAppProvider().provide(AppModule.register());

  const configurationService: IConfigurationService =
    app.get<IConfigurationService>(IConfigurationService);
  const applicationPort: string =
    configurationService.getOrThrow('application.port');

  const databaseMigrator = app.get(DatabaseMigrator);
  await databaseMigrator.migrate();

  await app.listen(applicationPort);
}

void bootstrap();

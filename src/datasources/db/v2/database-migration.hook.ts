import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

@Injectable()
export class DatabaseMigrationHook implements OnModuleInit {
  private readonly executeMigrations: boolean;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(DatabaseMigrator)
    private readonly migrationService: DatabaseMigrator,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.executeMigrations = this.configurationService.getOrThrow<boolean>(
      'db.migrator.executeMigrations',
    );
  }

  public async onModuleInit(): Promise<void> {
    if (!this.executeMigrations) {
      return this.loggingService.info('TypeOrm migrations are disabled!');
    }

    await this.postgresDatabaseService.initializeDatabaseConnection();
    await this.migrationService.migrate();
  }
}

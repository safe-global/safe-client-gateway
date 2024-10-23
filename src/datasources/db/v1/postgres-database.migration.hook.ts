import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import postgres from 'postgres';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { asError } from '@/logging/utils';

/**
 * The {@link PostgresDatabaseMigrationHook} is a Module Init hook meaning
 * that it will be executed once the dependencies are resolved.
 *
 * This happens before the Application Bootstraps, so route listeners are not
 * initiated and potentially generating queries.
 */
@Injectable({})
export class PostgresDatabaseMigrationHook implements OnModuleInit {
  private static LOCK_MAGIC_NUMBER = 132;
  private readonly runMigrations: boolean;

  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(PostgresDatabaseMigrator)
    private readonly migrator: PostgresDatabaseMigrator,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.runMigrations = this.configurationService.getOrThrow<boolean>(
      'application.runMigrations',
    );
  }

  /**
   * Function executed when the module is initialized.
   *
   * This function will check if the migrations are enabled and if so, it will
   * acquire a lock to perform a migration. If the lock is not acquired, then
   * a migration is being executed by another instance.
   *
   * If the lock is acquired, the migration will be executed and the lock will
   * be released.
   */
  async onModuleInit(): Promise<void> {
    if (!this.runMigrations) {
      return this.loggingService.info('Database migrations are disabled');
    }

    try {
      this.loggingService.info('Checking migrations');
      await this.acquireLock();
      const executed = await this.migrator.migrate();
      await this.releaseLock();
      this.loggingService.info(
        `Pending migrations executed: [${executed.map((m) => m.name).join(', ')}]`,
      );
    } catch (e) {
      this.loggingService.error(`Error running migrations: ${asError(e)}`);
    }
  }

  private async acquireLock(): Promise<void> {
    await this
      .sql`SELECT pg_advisory_lock(${PostgresDatabaseMigrationHook.LOCK_MAGIC_NUMBER})`;
  }

  private async releaseLock(): Promise<void> {
    await this
      .sql`SELECT pg_advisory_unlock(${PostgresDatabaseMigrationHook.LOCK_MAGIC_NUMBER})`;
  }
}

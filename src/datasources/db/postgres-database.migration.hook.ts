import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import * as shift from 'postgres-shift';
import postgres from 'postgres';

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

  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async onModuleInit() {
    this.loggingService.info('Checking migrations');
    try {
      const [lockAcquired] = await this
        .sql`SELECT pg_try_advisory_lock(${PostgresDatabaseMigrationHook.LOCK_MAGIC_NUMBER})`;
      if (!lockAcquired) {
        this.loggingService.debug(
          'Lock was already acquired by different session',
        );
        // If the lock was not acquired by this session, we exit since the migration is being
        // performed by a different instance.
        return;
      }
      // Perform migration
      await shift({ sql: this.sql });
      this.loggingService.info('Pending migrations executed');
    } catch (e) {
      // If there's an error performing a migration, we should throw the error
      // and prevent the service from starting
      this.loggingService.error(e);
      throw e;
    } finally {
      // the lock should be released if the migration completed (successfully or not)
      await this
        .sql`SELECT pg_advisory_unlock(${PostgresDatabaseMigrationHook.LOCK_MAGIC_NUMBER})`;
    }
  }
}

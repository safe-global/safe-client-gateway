import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import postgres from 'postgres';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import * as shift from 'postgres-shift';

/**
 * The {@link PostgresDatabaseMigrationHook} is a Module Init hook meaning
 * that it will be executed once the dependencies are resolved.
 *
 * This happens before the Application Bootstraps, so route listeners are not
 * initiated and potentially generating queries.
 */
@Injectable({})
export class PostgresDatabaseMigrationHook implements OnModuleInit {
  constructor(
    @Inject('DB_INSTANCE') private readonly db: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async onModuleInit() {
    this.loggingService.info('Checking migrations');
    await shift({ sql: this.db });
    this.loggingService.info('Pending migrations executed');
  }
}

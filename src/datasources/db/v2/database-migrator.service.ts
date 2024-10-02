import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';

interface LockSchema {
  id: number;
  name: number;
}

enum migrationStatus {
  RUNNING = 1,
}

@Injectable()
export class DatabaseMigrator {
  public constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,

    @Inject(PostgresDatabaseService)
    private readonly databaseService: PostgresDatabaseService,

    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    //
  }

  /**
   * Performs the migration operation.
   *
   * @returns {Promise<void>} A promise that resolves when the migration is complete.
   *
   * @throws {Error} Throws an error if unsuccessful after a specified number of retries."
   */
  public async migrate(): Promise<void> {
    this.loggingService.info('Migrations: Running...');

    const connection =
      await this.databaseService.initializeDatabaseConnection();
    await this.createLockTableIfNotExists(connection);

    let numberOfIterations = 0;
    const numberOfRetries = await this.configService.getOrThrow(
      'db.migrator.numberOfRetries',
    );
    while (numberOfRetries >= numberOfIterations) {
      ++numberOfIterations;
      if (!(await this.lockExists(connection))) {
        await this.insertLock(connection);
        await this.runMigration(connection);
        await this.truncateLocks(connection);

        this.loggingService.info('Migrations: Finished.');
        break;
      } else {
        if (numberOfIterations === numberOfRetries) {
          throw new Error(
            'Migrations: Migrations are still running in another instance!',
          );
        }
        this.loggingService.info('Migrations: Running in another instance...');
        const retryAfter = this.configService.getOrThrow<number>(
          'db.migrator.retryAfter',
        );

        await new Promise((resolve) => setTimeout(resolve, retryAfter));
      }
    }
  }

  /**
   * Creates the locks table in the database if it does not already exist.
   *
   * @param {DataSource} connection The database connection to create the locks table on.
   *
   * @returns {Promise<void>} A promise that resolves when the locks table has been created or confirmed to exist.
   */
  private async createLockTableIfNotExists(
    connection: DataSource,
  ): Promise<void> {
    await connection.query(
      'CREATE TABLE IF NOT EXISTS "_lock" ("id" SERIAL NOT NULL, "status" int NOT NULL, PRIMARY KEY ("id"))',
    );
  }

  /**
   * Inserts a new lock into the database.
   *
   * @param {DataSource} connection The database connection to insert the lock into.
   *
   * @returns {Promise<void>} A promise that resolves when the lock has been inserted.
   */
  private async insertLock(connection: DataSource): Promise<void> {
    await connection.query('INSERT INTO "_lock" (status) VALUES ($1);', [
      migrationStatus.RUNNING,
    ]);
  }

  /**
   * Truncates the locks table in the database.
   *
   * @param {DataSource} connection The database connection to truncate the locks table.
   *
   * @returns {Promise<void>} A promise that resolves when the locks table has been truncated.
   */
  private async truncateLocks(connection: DataSource): Promise<void> {
    await connection.query('TRUNCATE TABLE "_lock";');
  }

  /**
   * Selects and retrieves locks from the database.
   *
   * @param {DataSource} connection The database connection to select locks from.
   *
   * @returns {Promise<Array<LockSchema>>} A promise that resolves to an array of LockSchema objects.
   */
  private async selectLock(connection: DataSource): Promise<Array<LockSchema>> {
    return await connection.query('SELECT "id", "status" FROM "_lock";');
  }

  /**
   * Checks if a lock exists in the database.
   *
   * @param {DataSource} connection The database connection to check for the lock.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the lock exists, otherwise false.
   */
  private async lockExists(connection: DataSource): Promise<boolean> {
    const lock = await this.selectLock(connection);

    return lock && lock.length > 0;
  }

  /**
   * Runs the migration process for the given database connection.
   *
   * @param {DataSource} connection The database connection to run the migration on.
   *
   * @returns {Promise<void>} An empty promise that resolves when the migration is complete.
   */
  private async runMigration(connection: DataSource): Promise<void> {
    const migrations = await connection.runMigrations({ transaction: 'all' });

    if (migrations && migrations.length > 0) {
      this.loggingService.info(
        `Migrations: Successfully executed ${migrations.length} migrations.`,
      );
    } else {
      this.loggingService.info('Migrations: No migrations to execute.');
    }
  }
}

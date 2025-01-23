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

enum MigrationStatus {
  RUNNING = 1,
}

@Injectable()
export class DatabaseMigrator {
  private readonly LOCK_TABLE_NAME = '_lock';

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
   *    Since pg_advisory_lock locks are session-based, they seem to be quite unreliable for our use case.
   *    If the session is terminated, the lock is released, which could potentially cause issues in the database.
   *    For that reason we are implementing a lock mechanism
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
        const retryAfterMs = this.configService.getOrThrow<number>(
          'db.migrator.retryAfterMs',
        );

        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
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
      `CREATE TABLE IF NOT EXISTS "${this.LOCK_TABLE_NAME}" ("id" SERIAL NOT NULL, "status" int NOT NULL, PRIMARY KEY ("id"))`,
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
    await connection.query(
      `INSERT INTO "${this.LOCK_TABLE_NAME}" (status) VALUES ($1);`,
      [MigrationStatus.RUNNING],
    );
  }

  /**
   * Truncates the locks table in the database.
   *
   * @param {DataSource} connection The database connection to truncate the locks table.
   *
   * @returns {Promise<void>} A promise that resolves when the locks table has been truncated.
   */
  private async truncateLocks(connection: DataSource): Promise<void> {
    await connection.query(`TRUNCATE TABLE "${this.LOCK_TABLE_NAME}";`);
  }

  /**
   * Selects and retrieves locks from the database.
   *
   * @param {DataSource} connection The database connection to select locks from.
   *
   * @returns {Promise<Array<LockSchema>>} A promise that resolves to an array of LockSchema objects.
   */
  private async selectLock(connection: DataSource): Promise<Array<LockSchema>> {
    return await connection.query(
      `SELECT "id", "status" FROM "${this.LOCK_TABLE_NAME}";`,
    );
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
    try {
      const migrations = await connection.runMigrations({ transaction: 'all' });

      if (migrations && migrations.length > 0) {
        this.loggingService.info(
          `Migrations: Successfully executed ${migrations.length} migrations.`,
        );
      } else {
        this.loggingService.info('Migrations: No migrations to execute.');
      }
    } catch (error) {
      await this.truncateLocks(connection);

      throw error;
    }
  }
}

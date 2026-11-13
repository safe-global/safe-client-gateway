// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';

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
  // Advisory lock keys are database-wide, so this one is distinctive
  private readonly LOCK_TABLE_ADVISORY_KEY = 0x5afe_0002;

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

    let numberOfIterations = 0;
    const numberOfRetries = await this.configService.getOrThrow(
      'db.migrator.numberOfRetries',
    );
    while (numberOfRetries >= numberOfIterations) {
      ++numberOfIterations;
      const lock = await this.acquireLock(connection);
      if (lock === 'none-pending') {
        this.loggingService.info('Migrations: No migrations to execute.');
        break;
      }
      if (lock === 'acquired') {
        await this.runMigration(connection);
        await this.truncateLocks(connection);

        this.loggingService.info('Migrations: Finished.');
        break;
      }
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

  /**
   * Creates the locks table if needed and inserts a lock unless one exists or
   *    no migration is pending. Neither step is atomic, so concurrent instances
   *    are serialised by a transaction-scoped advisory lock.
   *
   * @param {DataSource} connection The database connection to check pending migrations on.
   *
   * @returns {Promise<'acquired' | 'busy' | 'none-pending'>} Whether this instance should run the migrations.
   */
  private async acquireLock(
    connection: DataSource,
  ): Promise<'acquired' | 'busy' | 'none-pending'> {
    return await this.databaseService.transaction(async (entityManager) => {
      await entityManager.query('SELECT pg_advisory_xact_lock($1)', [
        this.LOCK_TABLE_ADVISORY_KEY,
      ]);
      await this.createLockTableIfNotExists(entityManager);
      if (await this.lockExists(entityManager)) {
        return 'busy';
      }
      if (!(await connection.showMigrations())) {
        return 'none-pending';
      }
      await this.insertLock(entityManager);
      return 'acquired';
    });
  }

  /**
   * Creates the locks table in the database if it does not already exist.
   *
   * @param {EntityManager} entityManager The entity manager to create the locks table with.
   *
   * @returns {Promise<void>} A promise that resolves when the locks table has been created or confirmed to exist.
   */
  private async createLockTableIfNotExists(
    entityManager: EntityManager,
  ): Promise<void> {
    await entityManager.query(
      `CREATE TABLE IF NOT EXISTS "${this.LOCK_TABLE_NAME}" ("id" SERIAL NOT NULL, "status" int NOT NULL, PRIMARY KEY ("id"))`,
    );
  }

  /**
   * Inserts a new lock into the database.
   *
   * @param {EntityManager} entityManager The entity manager to insert the lock with.
   *
   * @returns {Promise<void>} A promise that resolves when the lock has been inserted.
   */
  private async insertLock(entityManager: EntityManager): Promise<void> {
    await entityManager.query(
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
   * @param {EntityManager} entityManager The entity manager to select locks with.
   *
   * @returns {Promise<Array<LockSchema>>} A promise that resolves to an array of LockSchema objects.
   */
  private async selectLock(
    entityManager: EntityManager,
  ): Promise<Array<LockSchema>> {
    return await entityManager.query(
      `SELECT "id", "status" FROM "${this.LOCK_TABLE_NAME}";`,
    );
  }

  /**
   * Checks if a lock exists in the database.
   *
   * @param {EntityManager} entityManager The entity manager to check for the lock with.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the lock exists, otherwise false.
   */
  private async lockExists(entityManager: EntityManager): Promise<boolean> {
    const lock = await this.selectLock(entityManager);

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

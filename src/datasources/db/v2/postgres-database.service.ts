import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { InjectDataSource } from '@nestjs/typeorm';
import { Inject, Injectable } from '@nestjs/common';
import {
  DataSource,
  type EntityManager,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';

@Injectable()
export class PostgresDatabaseService {
  private transactionManager?: EntityManager = undefined;

  public constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Returns the datasource object
   *
   * @returns {DataSource} Datasource object
   */
  public getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * Checks whether the datasource has been initialized or not
   *
   * @returns {boolean} True if the datasource has already been initialized
   */
  public isInitialized(): boolean {
    return this.dataSource.isInitialized;
  }

  /**
   * Initializes the database connection. If the connection is not initialized, it initializes the connection.
   *
   * @returns {Promise<DataSource>} The database connection.
   */
  public async initializeDatabaseConnection(): Promise<DataSource> {
    if (!this.isInitialized()) {
      this.loggingService.info('PostgresDatabaseService initialized...');
      await this.dataSource.initialize();
    }

    return this.dataSource;
  }

  /**
   * Destroys the database connection.
   *
   * @returns {Promise<DataSource>} The database connection.
   */
  public async destroyDatabaseConnection(): Promise<DataSource> {
    if (this.isInitialized()) {
      this.loggingService.info('PostgresDatabaseService destroyed...');
      await this.dataSource.destroy();
    }

    return this.dataSource;
  }

  /**
   * Fetches a repository for the given entity.
   *
   * @param {Object} entity - The entity class.
   *
   * @returns {Promise<Repository<T>>} The repository for the entity.
   */
  public async getRepository<T extends ObjectLiteral>(entity: {
    new (): T;
  }): Promise<Repository<T>> {
    if (!this.isInitialized()) {
      await this.initializeDatabaseConnection();
    }

    return this.dataSource.getRepository<T>(entity);
  }

  public async transaction<T>(
    callback: (transactionManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(
      async (transactionalEntityManager): Promise<T> => {
        this.transactionManager = transactionalEntityManager;
        return await callback(this.transactionManager);
      },
    );
  }

  public getTransactionRunner(): EntityManager {
    if (!this.transactionManager) {
      throw new Error('Query runner is not initialized...');
    }

    return this.transactionManager;
  }
}

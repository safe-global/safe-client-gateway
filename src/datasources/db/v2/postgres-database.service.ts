import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { InjectDataSource } from '@nestjs/typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type ObjectLiteral, type Repository } from 'typeorm';

@Injectable()
export class PostgresDatabaseService {
  public constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Fetches the database connection. If the connection is not initialized, it initializes the connection.
   *
   * @returns {Promise<DataSource>} The database connection.
   */
  public async fetchDatabaseConnection(): Promise<DataSource> {
    if (!this.dataSource.isInitialized) {
      this.loggingService.info('PostgresDatabaseService initialized...');
      await this.dataSource.initialize();
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
    const connection = await this.fetchDatabaseConnection();

    return connection.getRepository<T>(entity);
  }
}

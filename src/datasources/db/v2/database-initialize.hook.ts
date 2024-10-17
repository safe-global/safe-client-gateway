import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

@Injectable()
export class DatabaseInitializeHook implements OnModuleInit {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.postgresDatabaseService.initializeDatabaseConnection();
  }
}

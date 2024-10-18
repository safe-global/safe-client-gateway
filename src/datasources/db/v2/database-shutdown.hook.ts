import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

@Injectable()
export class DatabaseShutdownHook implements OnModuleDestroy {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async onModuleDestroy(): Promise<void> {
    await this.postgresDatabaseService.destroyDatabaseConnection();
  }
}

import { Module } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

@Module({
  providers: [PostgresDatabaseService],
  exports: [PostgresDatabaseService],
})
export class PostgresDatabaseModule {}

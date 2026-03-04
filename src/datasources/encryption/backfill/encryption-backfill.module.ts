// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { EncryptionBackfillService } from '@/datasources/encryption/backfill/encryption-backfill.service';

@Module({
  imports: [PostgresDatabaseModuleV2],
  providers: [EncryptionBackfillService],
  exports: [EncryptionBackfillService],
})
export class EncryptionBackfillModule {}

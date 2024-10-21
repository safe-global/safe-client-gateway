import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';
import { OutreachDbMapper } from '@/datasources/targeted-messaging/entities/outreach.db.mapper';
import { OutreachFileProcessor } from '@/datasources/targeted-messaging/outreach-file-processor';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule, CloudStorageModule],
  providers: [
    OutreachDbMapper,
    OutreachFileProcessor,
    {
      provide: ITargetedMessagingDatasource,
      useClass: TargetedMessagingDatasource,
    },
  ],
  exports: [ITargetedMessagingDatasource, OutreachFileProcessor],
})
export class TargetedMessagingDatasourceModule {}

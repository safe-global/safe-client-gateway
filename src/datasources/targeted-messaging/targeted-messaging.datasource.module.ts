import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';
import { OutreachFileProcessor } from '@/datasources/targeted-messaging/outreach-file-processor';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule, CloudStorageModule],
  providers: [
    OutreachFileProcessor,
    {
      provide: ITargetedMessagingDatasource,
      useClass: TargetedMessagingDatasource,
    },
  ],
  exports: [ITargetedMessagingDatasource, OutreachFileProcessor],
})
export class TargetedMessagingDatasourceModule {}

import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { OutreachFileProcessor } from '@/datasources/targeted-messaging/outreach-file-processor';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule],
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

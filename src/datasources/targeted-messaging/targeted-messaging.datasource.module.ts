import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    {
      provide: ITargetedMessagingDatasource,
      useClass: TargetedMessagingDatasource,
    },
  ],
  exports: [ITargetedMessagingDatasource],
})
export class TargetedMessagingDatasourceModule {}

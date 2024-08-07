import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { NotificationsDatasource } from '@/datasources/notifications/notifications.datasource';
import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule, AccountsDatasourceModule],
  providers: [
    { provide: INotificationsDatasource, useClass: NotificationsDatasource },
  ],
  exports: [INotificationsDatasource],
})
export class NotificationsDatasourceModule {}

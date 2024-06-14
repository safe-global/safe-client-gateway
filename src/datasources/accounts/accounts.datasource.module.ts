import { Module } from '@nestjs/common';
import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [{ provide: IAccountsDatasource, useClass: AccountsDatasource }],
  exports: [IAccountsDatasource],
})
export class AccountsDatasourceModule {}

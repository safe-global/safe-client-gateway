import { AccountsDatasource } from '@/modules/accounts/datasources/accounts.datasource';
import { EncryptionApiManager } from '@/modules/accounts/datasources/encryption/encryption-api.manager';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    { provide: IAccountsDatasource, useClass: AccountsDatasource },
    { provide: IEncryptionApiManager, useClass: EncryptionApiManager },
  ],
  exports: [IAccountsDatasource, IEncryptionApiManager],
})
export class AccountsDatasourceModule {}

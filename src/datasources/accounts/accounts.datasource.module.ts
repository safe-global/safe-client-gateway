import { Module } from '@nestjs/common';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { AwsEncryptionApiService } from '@/datasources/accounts/encryption/aws-encryption-api.service';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    { provide: IAccountsDatasource, useClass: AccountsDatasource },
    { provide: IEncryptionApi, useClass: AwsEncryptionApiService },
  ],
  exports: [IAccountsDatasource, IEncryptionApi],
})
export class AccountsDatasourceModule {}

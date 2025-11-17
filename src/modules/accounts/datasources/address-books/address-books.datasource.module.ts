import { AddressBooksDatasource } from '@/modules/accounts/datasources/address-books/address-books.datasource';
import { AddressBookDbMapper } from '@/modules/accounts/datasources/address-books/entities/address-book.db.mapper';
import { EncryptionApiManager } from '@/modules/accounts/datasources/encryption/encryption-api.manager';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { IAddressBooksDatasource } from '@/domain/interfaces/address-books.datasource.interface';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    AddressBookDbMapper,
    { provide: IAddressBooksDatasource, useClass: AddressBooksDatasource },
    { provide: IEncryptionApiManager, useClass: EncryptionApiManager },
  ],
  exports: [IAddressBooksDatasource, IEncryptionApiManager],
})
export class AddressBooksDatasourceModule {}

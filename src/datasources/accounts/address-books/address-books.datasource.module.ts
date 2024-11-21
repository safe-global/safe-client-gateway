import { AddressBooksDatasource } from '@/datasources/accounts/address-books/address-books.datasource';
import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { IAddressBooksDataSource } from '@/domain/interfaces/address-books.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    AddressBookDbMapper,
    {
      provide: IAddressBooksDataSource,
      useClass: AddressBooksDatasource,
    },
  ],
  exports: [IAddressBooksDataSource],
})
export class AddressBooksDatasourceModule {}

import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { AddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([AddressBookItem]),
  ],
  providers: [
    {
      provide: IAddressBookItemsRepository,
      useClass: AddressBookItemsRepository,
    },
  ],
  exports: [IAddressBookItemsRepository],
})
export class AddressBookItemsRepositoryModule {}

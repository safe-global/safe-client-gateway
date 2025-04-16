import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { AddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { SpacesRepository } from '@/domain/spaces/spaces.repository';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
import { UsersRepository } from '@/domain/users/users.repository';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';
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
    {
      provide: ISpacesRepository,
      useClass: SpacesRepository,
    },
    {
      provide: IUsersRepository,
      useClass: UsersRepository,
    },
    {
      provide: IWalletsRepository,
      useClass: WalletsRepository,
    },
  ],
  exports: [IAddressBookItemsRepository],
})
export class AddressBookItemsRepositoryModule {}

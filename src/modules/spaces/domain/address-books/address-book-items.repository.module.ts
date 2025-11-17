import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { AddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
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

// SPDX-License-Identifier: FSL-1.1-MIT

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { AuthModule } from '@/modules/auth/auth.module';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { AddressBookRequest } from '@/modules/spaces/datasources/entities/address-book-request.entity.db';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { UserAddressBookItem } from '@/modules/spaces/datasources/entities/user-address-book-item.entity.db';
import {
  ISpaceQueueApi,
  SpaceQueueApi,
} from '@/modules/spaces/datasources/space-queue-api.service';
import { AddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { AddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import { UserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository';
import { IUserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository.interface';
import { SpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { AddressBookRequestsController } from '@/modules/spaces/routes/address-book-requests.controller';
import { AddressBookRequestsService } from '@/modules/spaces/routes/address-book-requests.service';
import { AddressBooksController } from '@/modules/spaces/routes/address-books.controller';
import { AddressBooksService } from '@/modules/spaces/routes/address-books.service';
import { MembersController } from '@/modules/spaces/routes/members.controller';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { SpaceSafesController } from '@/modules/spaces/routes/space-safes.controller';
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';
import { SpaceTransactionsController } from '@/modules/spaces/routes/space-transactions.controller';
import { SpaceTransactionsService } from '@/modules/spaces/routes/space-transactions.service';
import { SpacesController } from '@/modules/spaces/routes/spaces.controller';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { UserAddressBookController } from '@/modules/spaces/routes/user-address-book.controller';
import { UserAddressBookService } from '@/modules/spaces/routes/user-address-book.service';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { UsersModule } from '@/modules/users/users.module';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([
      Space,
      SpaceSafe,
      Member,
      AddressBookItem,
      UserAddressBookItem,
      AddressBookRequest,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    DataDecoderModule,
    SafeRepositoryModule,
    TransactionsModule,
  ],
  controllers: [
    AddressBooksController,
    UserAddressBookController,
    AddressBookRequestsController,
    SpacesController,
    SpaceSafesController,
    SpaceTransactionsController,
    MembersController,
  ],
  providers: [
    AddressBooksService,
    UserAddressBookService,
    AddressBookRequestsService,
    SpacesService,
    SpaceSafesService,
    SpaceTransactionsService,
    MembersService,
    HttpErrorFactory,
    {
      provide: ISpaceQueueApi,
      useClass: SpaceQueueApi,
    },
    {
      provide: ISpacesRepository,
      useClass: SpacesRepository,
    },
    {
      provide: ISpaceSafesRepository,
      useClass: SpaceSafesRepository,
    },
    {
      provide: IAddressBookItemsRepository,
      useClass: AddressBookItemsRepository,
    },
    {
      provide: IUserAddressBookItemsRepository,
      useClass: UserAddressBookItemsRepository,
    },
    {
      provide: IAddressBookRequestsRepository,
      useClass: AddressBookRequestsRepository,
    },
    {
      provide: IWalletsRepository,
      useClass: WalletsRepository,
    },
  ],
  exports: [
    ISpacesRepository,
    ISpaceSafesRepository,
    IAddressBookItemsRepository,
    IUserAddressBookItemsRepository,
    IAddressBookRequestsRepository,
  ],
})
export class SpacesModule {}

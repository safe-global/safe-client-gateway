// SPDX-License-Identifier: FSL-1.1-MIT

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '@/config/entities/configuration';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { SesEmailModule } from '@/modules/email/ses/ses-email.module';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { AddressBookRequest } from '@/modules/spaces/datasources/entities/address-book-request.entity.db';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { UserAddressBookItem } from '@/modules/spaces/datasources/entities/user-address-book-item.entity.db';
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
import { SpaceInviteEmailService } from '@/modules/spaces/routes/space-invite-email.service';
import { SpaceSafesController } from '@/modules/spaces/routes/space-safes.controller';
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';
import { SpacesController } from '@/modules/spaces/routes/spaces.controller';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import {
  LegacySpaceIdPipe,
  SpaceIdPipe,
} from '@/modules/spaces/routes/pipes/space-id.pipe';
import { UserAddressBookController } from '@/modules/spaces/routes/user-address-book.controller';
import { UserAddressBookService } from '@/modules/spaces/routes/user-address-book.service';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { UserIdentityResolverModule } from '@/modules/users/domain/user-identity-resolver.module';
import { UsersModule } from '@/modules/users/users.module';
import { WalletsModule } from '@/modules/wallets/wallets.module';

const isSesEmailFeatureEnabled = configuration().features.sesEmail;

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
    ...(isSesEmailFeatureEnabled ? [SesEmailModule] : []),
    UserIdentityResolverModule,
    WalletsModule,
  ],
  controllers: [
    AddressBooksController,
    UserAddressBookController,
    AddressBookRequestsController,
    SpacesController,
    SpaceSafesController,
    MembersController,
  ],
  providers: [
    AddressBooksService,
    UserAddressBookService,
    AddressBookRequestsService,
    SpacesService,
    SpaceSafesService,
    MembersService,
    SpaceInviteEmailService,
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
    SpaceIdPipe,
    LegacySpaceIdPipe,
  ],
  exports: [
    ISpacesRepository,
    ISpaceSafesRepository,
    IAddressBookItemsRepository,
    IUserAddressBookItemsRepository,
    IAddressBookRequestsRepository,
    SpaceIdPipe,
    LegacySpaceIdPipe,
  ],
})
export class SpacesModule {}

// SPDX-License-Identifier: FSL-1.1-MIT

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '@/config/entities/configuration';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { SesEmailModule } from '@/modules/email/ses/ses-email.module';
import { AddressBookItem } from '@/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { AddressBookRequest } from '@/modules/spaces/datasources/address-books/entities/address-book-request.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { AddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { AddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import { SpaceAuditModule } from '@/modules/spaces/domain/audit/space-audit.module';
import { SpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { AddressBookRequestsController } from '@/modules/spaces/routes/address-books/address-book-requests.controller';
import { AddressBookRequestsService } from '@/modules/spaces/routes/address-books/address-book-requests.service';
import { AddressBooksController } from '@/modules/spaces/routes/address-books/address-books.controller';
import { AddressBooksService } from '@/modules/spaces/routes/address-books/address-books.service';
import { SpaceAuditController } from '@/modules/spaces/routes/audit/space-audit.controller';
import { SpaceAuditService } from '@/modules/spaces/routes/audit/space-audit.service';
import { MembersController } from '@/modules/spaces/routes/members/members.controller';
import { MembersService } from '@/modules/spaces/routes/members/members.service';
import { SpaceInviteEmailService } from '@/modules/spaces/routes/members/space-invite-email.service';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { SpaceSafesController } from '@/modules/spaces/routes/safes/space-safes.controller';
import { SpaceSafesService } from '@/modules/spaces/routes/safes/space-safes.service';
import { SpacesController } from '@/modules/spaces/routes/spaces.controller';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { UserIdentityResolverModule } from '@/modules/users/domain/user-identity-resolver/user-identity-resolver.module';
import { UsersModule } from '@/modules/users/users.module';
import { WalletEncryptionModule } from '@/modules/wallets/domain/wallet-encryption.module';
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
      AddressBookRequest,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    ...(isSesEmailFeatureEnabled ? [SesEmailModule] : []),
    SpaceAuditModule,
    UserIdentityResolverModule,
    WalletsModule,
    WalletEncryptionModule,
  ],
  controllers: [
    AddressBooksController,
    AddressBookRequestsController,
    SpacesController,
    SpaceAuditController,
    SpaceSafesController,
    MembersController,
  ],
  providers: [
    AddressBooksService,
    AddressBookRequestsService,
    SpacesService,
    SpaceAuditService,
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
      provide: IAddressBookRequestsRepository,
      useClass: AddressBookRequestsRepository,
    },
    SpaceIdPipe,
  ],
  exports: [
    ISpacesRepository,
    ISpaceSafesRepository,
    IAddressBookItemsRepository,
    IAddressBookRequestsRepository,
    SpaceIdPipe,
  ],
})
export class SpacesModule {}

import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { SpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { AddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { AddressBooksController } from '@/modules/spaces/routes/address-books.controller';
import { AddressBooksService } from '@/modules/spaces/routes/address-books.service';
import { SpaceSafesController } from '@/modules/spaces/routes/space-safes.controller';
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';
import { SpacesController } from '@/modules/spaces/routes/spaces.controller';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { MembersController } from '@/modules/spaces/routes/members.controller';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Space, SpaceSafe, Member, AddressBookItem]),
    AuthModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    AddressBooksController,
    SpacesController,
    SpaceSafesController,
    MembersController,
  ],
  providers: [
    AddressBooksService,
    SpacesService,
    SpaceSafesService,
    MembersService,
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
      provide: IWalletsRepository,
      useClass: WalletsRepository,
    },
  ],
  exports: [
    ISpacesRepository,
    ISpaceSafesRepository,
    IAddressBookItemsRepository,
  ],
})
export class SpacesModule {}

import { AuthModule } from '@/modules/auth/auth.module';
import { AddressBookItemsRepositoryModule } from '@/modules/spaces/domain/address-books/address-book-items.repository.module';
import { SpacesRepositoryModule } from '@/modules/spaces/domain/spaces.repository.module';
import { MembersRepositoryModule } from '@/modules/users/domain/members.repository.module';
import { UserRepositoryModule } from '@/modules/users/domain/users.repository.module';
import { AddressBooksController } from '@/modules/spaces/routes/address-books.controller';
import { AddressBooksService } from '@/modules/spaces/routes/address-books.service';
import { SpaceSafesController } from '@/modules/spaces/routes/space-safes.controller';
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';
import { SpacesController } from '@/modules/spaces/routes/spaces.controller';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AddressBookItemsRepositoryModule,
    AuthModule,
    MembersRepositoryModule,
    SpacesRepositoryModule,
    UserRepositoryModule,
  ],
  controllers: [AddressBooksController, SpacesController, SpaceSafesController],
  providers: [AddressBooksService, SpacesService, SpaceSafesService],
})
export class SpacesModule {}

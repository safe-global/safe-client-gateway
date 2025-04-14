import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { AddressBookItemsRepositoryModule } from '@/domain/spaces/address-books/address-book-items.repository.module';
import { SpacesRepositoryModule } from '@/domain/spaces/spaces.repository.module';
import { MembersRepositoryModule } from '@/domain/users/members.repository.module';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { SpaceSafesController } from '@/routes/spaces/space-safes.controller';
import { SpaceSafesService } from '@/routes/spaces/space-safes.service';
import { SpacesController } from '@/routes/spaces/spaces.controller';
import { SpacesService } from '@/routes/spaces/spaces.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AddressBookItemsRepositoryModule,
    AuthRepositoryModule,
    MembersRepositoryModule,
    SpacesRepositoryModule,
    UserRepositoryModule,
  ],
  controllers: [SpacesController, SpaceSafesController],
  providers: [SpacesService, SpaceSafesService],
})
export class SpacesModule {}

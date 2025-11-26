import { Module } from '@nestjs/common';
import { AddressBookItemsRepositoryModule } from '@/modules/spaces/domain/address-books/address-book-items.repository.module';
import { SpacesRepositoryModule } from '@/modules/spaces/domain/spaces.repository.module';
import { MembersModule as MembersRoutesModule } from '@/modules/spaces/routes/members.module';
import { SpacesModule as SpacesRoutesModule } from '@/modules/spaces/routes/spaces.module';

@Module({
  imports: [
    AddressBookItemsRepositoryModule,
    SpacesRepositoryModule,
    MembersRoutesModule,
    SpacesRoutesModule,
  ],
})
export class SpacesModule {}

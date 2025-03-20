import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { OrganizationsRepositoryModule as SpacesRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { UsersOrganizationsRepositoryModule as MembersRepositoryModule } from '@/domain/users/user-organizations.repository.module';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { SpaceSafesController } from '@/routes/spaces/space-safes.controller';
import { SpaceSafesService } from '@/routes/spaces/space-safes.service';
import { SpacesController } from '@/routes/spaces/spaces.controller';
import { SpacesService } from '@/routes/spaces/spaces.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AuthRepositoryModule,
    SpacesRepositoryModule,
    UserRepositoryModule,
    MembersRepositoryModule,
  ],
  controllers: [SpacesController, SpaceSafesController],
  providers: [SpacesService, SpaceSafesService],
})
export class SpacesModule {}

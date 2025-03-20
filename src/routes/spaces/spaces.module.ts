import { Module } from '@nestjs/common';
import { OrganizationsRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { SpacesController } from '@/routes/spaces/spaces.controller';
import { OrganizationsService } from '@/routes/spaces/spaces.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { SpaceSafesController } from '@/routes/spaces/space-safes.controller';
import { SpaceSafesService } from '@/routes/spaces/space-safes.service';
import { UsersOrganizationsRepositoryModule } from '@/domain/users/user-organizations.repository.module';

@Module({
  imports: [
    AuthRepositoryModule,
    OrganizationsRepositoryModule,
    UserRepositoryModule,
    UsersOrganizationsRepositoryModule,
  ],
  controllers: [SpacesController, SpaceSafesController],
  providers: [OrganizationsService, SpaceSafesService],
})
export class OrganizationsModule {}

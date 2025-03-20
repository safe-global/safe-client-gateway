import { Module } from '@nestjs/common';
import { OrganizationsRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { OrganizationsController } from '@/routes/organizations/organizations.controller';
import { OrganizationsService } from '@/routes/organizations/organizations.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { OrganizationSafesController } from '@/routes/organizations/organization-safes.controller';
import { OrganizationSafesService } from '@/routes/organizations/organization-safes.service';
import { UsersOrganizationsRepositoryModule } from '@/domain/users/user-organizations.repository.module';

@Module({
  imports: [
    AuthRepositoryModule,
    OrganizationsRepositoryModule,
    UserRepositoryModule,
    UsersOrganizationsRepositoryModule,
  ],
  controllers: [OrganizationsController, OrganizationSafesController],
  providers: [OrganizationsService, OrganizationSafesService],
})
export class OrganizationsModule {}

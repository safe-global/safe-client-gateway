import { Module } from '@nestjs/common';
import { OrganizationsRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { OrganizationsController } from '@/routes/organizations/organizations.controller';
import { OrganizationsService } from '@/routes/organizations/organizations.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { OrganizationSafesController } from '@/routes/organizations/organization-safes.controller';
import { OrganizationSafesService } from '@/routes/organizations/organization-safes.service';
import { WalletsRepositoryModule } from '@/domain/wallets/wallets.repository.module';

@Module({
  imports: [
    OrganizationsRepositoryModule,
    AuthRepositoryModule,
    UserRepositoryModule,
    WalletsRepositoryModule,
  ],
  controllers: [OrganizationsController, OrganizationSafesController],
  providers: [OrganizationsService, OrganizationSafesService],
})
export class OrganizationsModule {}

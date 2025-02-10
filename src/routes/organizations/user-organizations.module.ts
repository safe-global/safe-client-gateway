import { Module } from '@nestjs/common';
import { UsersOrganizationsRepositoryModule } from '@/domain/users/user-organizations.repository.module';
import { UserOrganizationsController } from '@/routes/organizations/user-organizations.controller';
import { UserOrganizationsService } from '@/routes/organizations/user-organizations.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';

@Module({
  imports: [UsersOrganizationsRepositoryModule, AuthRepositoryModule],
  controllers: [UserOrganizationsController],
  providers: [UserOrganizationsService],
})
export class UserOrganizationsModule {}

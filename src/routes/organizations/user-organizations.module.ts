import { Module } from '@nestjs/common';
import { UsersOrganizationsRepositoryModule } from '@/domain/users/user-organizations.repository.module';
import { UserOrganizationsController } from '@/routes/organizations/user-organizations.controller';
import { UserOrganizationsService } from '@/routes/organizations/user-organizations.service';

@Module({
  imports: [UsersOrganizationsRepositoryModule],
  controllers: [UserOrganizationsController],
  providers: [UserOrganizationsService],
})
export class UserOrganizationsModule {}

import { Module } from '@nestjs/common';
import { UsersOrganizationsRepositoryModule } from '@/domain/users/user-organizations.repository.module';
import { MembersController } from '@/routes/spaces/members.controller';
import { MembersService } from '@/routes/spaces/members.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';

@Module({
  imports: [UsersOrganizationsRepositoryModule, AuthRepositoryModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class UserOrganizationsModule {}

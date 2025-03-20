import { Module } from '@nestjs/common';
import { UsersOrganizationsRepositoryModule as MembersRepositoryModule } from '@/domain/users/user-organizations.repository.module';
import { MembersController } from '@/routes/spaces/members.controller';
import { MembersService } from '@/routes/spaces/members.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';

@Module({
  imports: [MembersRepositoryModule, AuthRepositoryModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}

import { Module } from '@nestjs/common';
import { MembersRepositoryModule } from '@/modules/users/domain/members.repository.module';
import { MembersController } from '@/modules/spaces/routes/members.controller';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [MembersRepositoryModule, AuthModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}

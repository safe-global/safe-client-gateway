import { Module } from '@nestjs/common';
import { UsersModule } from '@/modules/users/users.module';
import { MembersController } from '@/modules/spaces/routes/members.controller';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}

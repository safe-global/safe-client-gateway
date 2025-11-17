import { Module } from '@nestjs/common';
import { MembersRepositoryModule } from '@/modules/users/domain/members.repository.module';
import { MembersController } from '@/modules/spaces/routes/members.controller';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth.repository.interface';

@Module({
  imports: [MembersRepositoryModule, AuthRepositoryModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}

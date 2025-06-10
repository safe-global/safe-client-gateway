import { Module } from '@nestjs/common';
import { MembersRepositoryModule } from '@/domain/users/members.repository.module';
import { MembersController } from '@/routes/spaces/members.controller';
import { MembersService } from '@/routes/spaces/members.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { AuthService } from '@/routes/auth/auth.service';
import { SiweRepositoryModule } from '@/domain/siwe/siwe.repository.interface';

@Module({
  imports: [MembersRepositoryModule, AuthRepositoryModule, SiweRepositoryModule],
  controllers: [MembersController],
  providers: [MembersService, AuthService],
  exports: [MembersService],
})
export class MembersModule {}

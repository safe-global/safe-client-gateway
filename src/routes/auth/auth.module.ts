import { Module } from '@nestjs/common';
import { AuthController } from '@/routes/auth/auth.controller';
import { AuthService } from '@/routes/auth/auth.service';
import { SiweRepositoryModule } from '@/domain/siwe/siwe.repository.interface';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { MembersRepositoryModule } from '@/domain/users/members.repository.module';
import { MembersModule } from '@/routes/spaces/members.module';

@Module({
  imports: [SiweRepositoryModule, AuthRepositoryModule, MembersRepositoryModule, MembersModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}

// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth-repository.module';
import { AuthController } from '@/modules/auth/routes/auth.controller';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [AuthRepositoryModule, SiweModule, forwardRef(() => UsersModule)],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthRepositoryModule],
})
export class AuthModule {}

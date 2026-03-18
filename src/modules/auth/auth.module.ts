// SPDX-License-Identifier: FSL-1.1-MIT
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { Auth0Module } from '@/modules/auth/auth0/auth0.module';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { UsersModule } from '@/modules/users/users.module';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthRepository } from '@/modules/auth/domain/auth.repository';
import { AuthController } from '@/modules/auth/routes/auth.controller';
import { AuthService } from '@/modules/auth/routes/auth.service';

@Module({
  imports: [Auth0Module, JwtModule, SiweModule, forwardRef(() => UsersModule)],
  providers: [
    {
      provide: IAuthRepository,
      useClass: AuthRepository,
    },
    AuthService,
  ],
  controllers: [AuthController],
  exports: [IAuthRepository, Auth0Module],
})
export class AuthModule {}

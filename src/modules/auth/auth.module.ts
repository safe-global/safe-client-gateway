// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthRepository } from '@/modules/auth/domain/auth.repository';
import { AuthController } from '@/modules/auth/routes/auth.controller';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auth } from '@/modules/auth/datasources/entities/auth.entity.db';

@Module({
  imports: [TypeOrmModule.forFeature([Auth]), JwtModule, SiweModule],
  providers: [
    {
      provide: IAuthRepository,
      useClass: AuthRepository,
    },
    AuthService,
  ],
  controllers: [AuthController],
  exports: [IAuthRepository],
})
export class AuthModule {}

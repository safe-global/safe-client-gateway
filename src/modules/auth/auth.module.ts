import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthRepository } from '@/modules/auth/domain/auth.repository';
import { AuthController } from '@/modules/auth/routes/auth.controller';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { ExternalAuthModule } from '@/modules/auth/external-auth.module';

@Module({
  imports: [JwtModule, SiweModule, ExternalAuthModule],
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

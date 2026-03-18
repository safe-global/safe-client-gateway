// SPDX-License-Identifier: FSL-1.1-MIT
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { Auth0Module } from '@/modules/auth/oidc/auth0/auth0.module';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthRepository } from '@/modules/auth/domain/auth.repository';
import { OidcAuthController } from '@/modules/auth/oidc/routes/oidc-auth.controller';
import { OidcAuthService } from '@/modules/auth/oidc/routes/oidc-auth.service';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [Auth0Module, JwtModule, forwardRef(() => UsersModule)],
  providers: [
    {
      provide: IAuthRepository,
      useClass: AuthRepository,
    },
    OidcAuthService,
  ],
  controllers: [OidcAuthController],
})
export class OidcAuthModule {}

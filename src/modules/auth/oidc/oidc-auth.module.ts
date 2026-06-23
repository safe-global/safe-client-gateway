// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth-repository.module';
import { Auth0Module } from '@/modules/auth/oidc/auth0/auth0.module';
import { OidcAuthController } from '@/modules/auth/oidc/routes/oidc-auth.controller';
import { OidcAuthService } from '@/modules/auth/oidc/routes/oidc-auth.service';
import { UsersRepositoryModule } from '@/modules/users/domain/users-repository.module';

@Module({
  imports: [AuthRepositoryModule, Auth0Module, UsersRepositoryModule],
  providers: [OidcAuthService],
  controllers: [OidcAuthController],
})
export class OidcAuthModule {}

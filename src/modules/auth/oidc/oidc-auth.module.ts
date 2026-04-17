// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth-repository.module';
import { Auth0Module } from '@/modules/auth/oidc/auth0/auth0.module';
import { OidcAuthController } from '@/modules/auth/oidc/routes/oidc-auth.controller';
import { OidcAuthService } from '@/modules/auth/oidc/routes/oidc-auth.service';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [AuthRepositoryModule, Auth0Module, forwardRef(() => UsersModule)],
  providers: [OidcAuthService],
  controllers: [OidcAuthController],
})
export class OidcAuthModule {}

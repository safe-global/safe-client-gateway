// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { AuthRepository } from '@/modules/auth/domain/auth.repository';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';

/**
 * Standalone module for {@link IAuthRepository} so that both {@link AuthModule}
 * (SiWe) and {@link OidcAuthModule} (Auth0) can share the same provider without
 * coupling to each other.
 */
@Module({
  imports: [JwtModule],
  providers: [{ provide: IAuthRepository, useClass: AuthRepository }],
  exports: [IAuthRepository],
})
export class AuthRepositoryModule {}

// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { OidcProviderController } from '@/modules/auth/oidc-provider/routes/oidc-provider.controller';
import { OidcProviderService } from '@/modules/auth/oidc-provider/routes/oidc-provider.service';
import { SiweModule } from '@/modules/siwe/siwe.module';

/**
 * Exposes CGW as a Sign-in with Ethereum OAuth 2.0/OIDC provider.
 * Gated by the `FF_OIDC_PROVIDER` feature flag.
 * See `OIDC_PROVIDER.md` for the flow and Auth0 setup instructions.
 */
@Module({
  imports: [JwtModule, SiweModule],
  providers: [OidcProviderService],
  controllers: [OidcProviderController],
})
export class OidcProviderModule {}

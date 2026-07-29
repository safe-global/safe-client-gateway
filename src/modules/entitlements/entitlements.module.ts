// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { EntitlementsDomainModule } from '@/modules/entitlements/entitlements-domain.module';
import { EntitlementsController } from '@/modules/entitlements/routes/entitlements.controller';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * Routes layer of the entitlements feature
 * (`GET/PUT /v1/spaces/:spaceId/entitlements[...]`). Conditionally imported
 * in `app.module.ts` behind FF_BILLING_SERVICE, unlike
 * `EntitlementsDomainModule` which is always loaded.
 */
@Module({
  imports: [
    EntitlementsDomainModule,
    forwardRef(() => AuthModule),
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
})
export class EntitlementsModule {}

// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { EntitlementsModule } from '@/modules/entitlements/entitlements.module';
import { EntitlementsController } from '@/modules/entitlements/routes/entitlements.controller';
import { SpacesModule } from '@/modules/spaces/spaces.module';

/**
 * The HTTP surface of the entitlements feature, kept apart from
 * `EntitlementsModule` so `FF_USERS` can gate it: that module is imported for
 * plan enforcement by whoever owns a gated action, `SpacesModule` included,
 * and Nest registers a loaded module's controllers whoever imported it — so a
 * controller declared there would serve regardless of this flag.
 *
 * `AuthGuard` resolves `IAuthRepository` here, and `SpaceIdPipe`
 * `ISpacesRepository`.
 */
@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => SpacesModule),
    EntitlementsModule,
  ],
  controllers: [EntitlementsController],
})
export class EntitlementsRoutesModule {}

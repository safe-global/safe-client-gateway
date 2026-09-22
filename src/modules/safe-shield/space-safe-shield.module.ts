// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { EntitlementsModule } from '@/modules/entitlements/entitlements.module';
import { SpaceSafeShieldController } from '@/modules/safe-shield/routes/space-safe-shield.controller';
import { SpaceSafeShieldService } from '@/modules/safe-shield/routes/space-safe-shield.service';
import { SafeShieldModule } from '@/modules/safe-shield/safe-shield.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * Space-scoped Copilot recipient/counterparty analysis, kept apart from
 * `SafeShieldModule` because that module is unconditional and `SpacesModule`
 * is not: importing `SpacesModule` from there would serve its controllers
 * even with `features.users` off. `AppModule` registers this one alongside
 * `SpacesModule`, under the same flag.
 *
 * `AuthGuard` resolves `IAuthRepository` here, `SpaceIdPipe`
 * `ISpacesRepository`, and `assertMember` `IMembersRepository`.
 */
@Module({
  imports: [
    SafeShieldModule,
    AuthModule,
    SpacesModule,
    UsersModule,
    EntitlementsModule,
  ],
  controllers: [SpaceSafeShieldController],
  providers: [SpaceSafeShieldService],
})
export class SpaceSafeShieldModule {}

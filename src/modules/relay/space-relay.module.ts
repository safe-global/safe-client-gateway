// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { EntitlementsModule } from '@/modules/entitlements/entitlements.module';
import { RelayApiModule } from '@/modules/relay/datasources/relay-api.module';
import { RelayDomainModule } from '@/modules/relay/domain/relay.domain.module';
import { WorkspaceRelayer } from '@/modules/relay/domain/relayers/workspace.relayer';
import { SpaceRelayController } from '@/modules/relay/routes/space-relay.controller';
import { SpaceRelayService } from '@/modules/relay/routes/space-relay.service';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * Relaying at a workspace's expense, kept apart from `RelayModule` because its
 * dependencies are feature-flagged and that module is not: Nest registers a
 * loaded module's controllers whoever imported it, so importing `SpacesModule`
 * or `UsersModule` from there would serve their endpoints even with the flags
 * that gate them switched off. `AppModule` registers this one under the same
 * flags as `EntitlementsRoutesModule`.
 *
 * `AuthGuard` resolves `IAuthRepository` here, `SpaceIdPipe`
 * `ISpacesRepository`, and `assertMember` `IMembersRepository`.
 */
@Module({
  imports: [
    RelayApiModule,
    RelayDomainModule,
    ChainsModule,
    EntitlementsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
  ],
  providers: [WorkspaceRelayer, SpaceRelayService],
  controllers: [SpaceRelayController],
})
export class SpaceRelayModule {}

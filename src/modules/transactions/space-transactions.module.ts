// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthModule } from '#/modules/auth/auth.module';
import { SpacesModule } from '#/modules/spaces/spaces.module';
import { SpaceTransactionsController } from '#/modules/transactions/routes/space-transactions.controller';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { TransactionsModule } from '#/modules/transactions/transactions.module';
import { UsersModule } from '#/modules/users/users.module';
import { WalletsModule } from '#/modules/wallets/wallets.module';

/**
 * The transaction queue of a Space, kept apart from `TransactionsModule`
 * because that module is unconditional and `SpacesModule` is not: importing
 * `SpacesModule` from there would serve its controllers even with
 * `features.users` off. `AppModule` registers this one alongside
 * `SpacesModule`, and only with `features.safeQueueService` on, the one
 * upstream able to list many Safes in a request.
 *
 * `AuthGuard` resolves `IAuthRepository` here, `SpaceIdPipe`
 * `ISpacesRepository`, `assertMember` `IMembersRepository`, and the "sign"
 * count the caller's wallets from `IWalletsRepository`.
 */
@Module({
  imports: [
    TransactionsModule,
    AuthModule,
    SpacesModule,
    UsersModule,
    WalletsModule,
  ],
  controllers: [SpaceTransactionsController],
  providers: [SpaceTransactionsService],
})
export class SpaceTransactionsModule {}

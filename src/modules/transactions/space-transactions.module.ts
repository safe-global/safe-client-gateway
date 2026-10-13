// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthModule } from '#/modules/auth/auth.module';
import { SpacesModule } from '#/modules/spaces/spaces.module';
import { SpaceTransactionsController } from '#/modules/transactions/routes/space-transactions.controller';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { TransactionsModule } from '#/modules/transactions/transactions.module';
import { UsersModule } from '#/modules/users/users.module';

/**
 * Kept apart from `TransactionsModule` because that module is unconditional
 * and `SpacesModule` is not. `AppModule` registers this one alongside
 * `SpacesModule`, under the same flag.
 */
@Module({
  imports: [TransactionsModule, AuthModule, SpacesModule, UsersModule],
  controllers: [SpaceTransactionsController],
  providers: [SpaceTransactionsService],
})
export class SpaceTransactionsModule {}

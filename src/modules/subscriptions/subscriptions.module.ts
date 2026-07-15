// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Subscription } from '@/modules/subscriptions/datasources/entities/subscription.entity.db';
import { SubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository';
import { ISubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository.interface';

@Module({
  imports: [PostgresDatabaseModuleV2, TypeOrmModule.forFeature([Subscription])],
  providers: [
    {
      provide: ISubscriptionsRepository,
      useClass: SubscriptionsRepository,
    },
  ],
  exports: [ISubscriptionsRepository],
})
export class SubscriptionsModule {}

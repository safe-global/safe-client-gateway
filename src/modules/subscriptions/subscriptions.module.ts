// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { SubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository';
import { ISubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository.interface';

// No TypeOrmModule.forFeature() here: entities are registered globally via
// orm.config.ts's file-glob (for migrations), and repositories are accessed
// through PostgresDatabaseService.getRepository(), not @InjectRepository() —
// this codebase doesn't use NestJS's own repository-injection machinery.
@Module({
  imports: [PostgresDatabaseModuleV2],
  providers: [
    {
      provide: ISubscriptionsRepository,
      useClass: SubscriptionsRepository,
    },
  ],
  exports: [ISubscriptionsRepository],
})
export class SubscriptionsModule {}

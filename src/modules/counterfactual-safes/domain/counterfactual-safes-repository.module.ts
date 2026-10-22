// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '#/datasources/db/v2/postgres-database.module';
import { CounterfactualSafe } from '#/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { CounterfactualSafeUser } from '#/modules/counterfactual-safes/datasources/entities/counterfactual-safe-user.entity.db';
import { CounterfactualSafesRepository } from '#/modules/counterfactual-safes/domain/counterfactual-safes.repository';
import { ICounterfactualSafesRepository } from '#/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';

/**
 * Standalone module for {@link ICounterfactualSafesRepository}, so that the
 * hooks module can consume it without the routes and forward imports of
 * {@link CounterfactualSafesModule}.
 */
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([CounterfactualSafe, CounterfactualSafeUser]),
  ],
  providers: [
    {
      provide: ICounterfactualSafesRepository,
      useClass: CounterfactualSafesRepository,
    },
  ],
  exports: [ICounterfactualSafesRepository],
})
export class CounterfactualSafesRepositoryModule {}

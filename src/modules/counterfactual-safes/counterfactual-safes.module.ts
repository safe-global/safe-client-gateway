// SPDX-License-Identifier: FSL-1.1-MIT

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { CounterfactualSafeUser } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe-user.entity.db';
import { CounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { CounterfactualSafesController } from '@/modules/counterfactual-safes/routes/counterfactual-safes.controller';
import { CounterfactualSafesService } from '@/modules/counterfactual-safes/routes/counterfactual-safes.service';
import { SpaceCounterfactualSafesController } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.controller';
import { SpaceCounterfactualSafesService } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([CounterfactualSafe, CounterfactualSafeUser]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SpacesModule),
    SafeRepositoryModule,
  ],
  controllers: [
    CounterfactualSafesController,
    SpaceCounterfactualSafesController,
  ],
  providers: [
    CounterfactualSafesService,
    SpaceCounterfactualSafesService,
    {
      provide: ICounterfactualSafesRepository,
      useClass: CounterfactualSafesRepository,
    },
  ],
  exports: [ICounterfactualSafesRepository],
})
export class CounterfactualSafesModule {}

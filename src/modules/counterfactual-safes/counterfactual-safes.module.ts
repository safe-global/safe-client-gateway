// SPDX-License-Identifier: FSL-1.1-MIT
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { CounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { CounterfactualSafesController } from '@/modules/counterfactual-safes/routes/counterfactual-safes.controller';
import { CounterfactualSafesService } from '@/modules/counterfactual-safes/routes/counterfactual-safes.service';
import { SpaceCounterfactualSafesController } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.controller';
import { SpaceCounterfactualSafesService } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.service';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([CounterfactualSafe]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SpacesModule),
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

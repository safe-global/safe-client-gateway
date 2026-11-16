// SPDX-License-Identifier: FSL-1.1-MIT

import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '#/modules/auth/auth.module';
import { CounterfactualSafesRepositoryModule } from '#/modules/counterfactual-safes/domain/counterfactual-safes-repository.module';
import { CounterfactualSafesController } from '#/modules/counterfactual-safes/routes/counterfactual-safes.controller';
import { CounterfactualSafesService } from '#/modules/counterfactual-safes/routes/counterfactual-safes.service';
import { SpaceCounterfactualSafesController } from '#/modules/counterfactual-safes/routes/space-counterfactual-safes.controller';
import { SpaceCounterfactualSafesService } from '#/modules/counterfactual-safes/routes/space-counterfactual-safes.service';
import { SafeRepositoryModule } from '#/modules/safe/domain/safe.repository.interface';
import { SpacesModule } from '#/modules/spaces/spaces.module';
import { UsersModule } from '#/modules/users/users.module';

@Module({
  imports: [
    CounterfactualSafesRepositoryModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SpacesModule),
    SafeRepositoryModule,
  ],
  controllers: [
    CounterfactualSafesController,
    SpaceCounterfactualSafesController,
  ],
  providers: [CounterfactualSafesService, SpaceCounterfactualSafesService],
  exports: [CounterfactualSafesRepositoryModule],
})
export class CounterfactualSafesModule {}

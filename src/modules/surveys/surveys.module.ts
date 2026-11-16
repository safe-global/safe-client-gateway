// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthModule } from '#/modules/auth/auth.module';
import { SpacesModule } from '#/modules/spaces/spaces.module';
import { SurveysRepositoryModule } from '#/modules/surveys/domain/surveys-repository.module';
import { SurveysController } from '#/modules/surveys/routes/surveys.controller';
import { SurveysService } from '#/modules/surveys/routes/surveys.service';
import { UsersModule } from '#/modules/users/users.module';

@Module({
  imports: [SurveysRepositoryModule, AuthModule, UsersModule, SpacesModule],
  controllers: [SurveysController],
  providers: [SurveysService],
})
export class SurveysModule {}

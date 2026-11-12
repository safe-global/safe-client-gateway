// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '#/datasources/db/v2/postgres-database.module';
import { Survey } from '#/modules/surveys/datasources/entities/survey.entity.db';
import { SurveyResponse } from '#/modules/surveys/datasources/entities/survey-response.entity.db';
import { SurveysRepository } from '#/modules/surveys/domain/surveys.repository';
import { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';

/**
 * The surveys data layer on its own, so `SpacesModule` can save the survey of
 * a Workspace setup without importing `SurveysModule`, which imports it back.
 */
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Survey, SurveyResponse]),
  ],
  providers: [{ provide: ISurveysRepository, useClass: SurveysRepository }],
  exports: [ISurveysRepository],
})
export class SurveysRepositoryModule {}

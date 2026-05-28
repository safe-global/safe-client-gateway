// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { Survey } from '@/modules/surveys/datasources/entities/survey.entity.db';
import { SurveyResponse } from '@/modules/surveys/datasources/entities/survey-response.entity.db';
import { SurveysRepository } from '@/modules/surveys/domain/surveys.repository';
import { ISurveysRepository } from '@/modules/surveys/domain/surveys.repository.interface';
import { SurveysController } from '@/modules/surveys/routes/surveys.controller';
import { SurveysService } from '@/modules/surveys/routes/surveys.service';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Survey, SurveyResponse]),
    AuthModule,
    UsersModule,
  ],
  controllers: [SurveysController],
  providers: [
    SurveysService,
    {
      provide: ISurveysRepository,
      useClass: SurveysRepository,
    },
  ],
  exports: [ISurveysRepository],
})
export class SurveysModule {}

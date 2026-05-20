// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SurveyResponse as DbSurveyResponse } from '@/modules/surveys/datasources/entities/survey-response.entity.db';
import { Survey as DbSurvey } from '@/modules/surveys/datasources/entities/survey.entity.db';
import type {
  SurveyResponse,
  SurveyResponseSelections,
} from '@/modules/surveys/domain/entities/survey-response.entity';
import type { Survey } from '@/modules/surveys/domain/entities/survey.entity';
import type { ISurveysRepository } from '@/modules/surveys/domain/surveys.repository.interface';
import type { User } from '@/modules/users/domain/entities/user.entity';

@Injectable()
export class SurveysRepository implements ISurveysRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async findActiveBySlug(
    slug: Survey['slug'],
  ): Promise<Survey | null> {
    const repo = await this.postgresDatabaseService.getRepository(DbSurvey);
    return await repo.findOne({
      where: { slug, isActive: true },
    });
  }

  public async findResponse(args: {
    spaceId: Space['id'];
    surveyId: Survey['id'];
  }): Promise<SurveyResponse | null> {
    const repo =
      await this.postgresDatabaseService.getRepository(DbSurveyResponse);
    return await repo.findOne({
      where: {
        space: { id: args.spaceId },
        survey: { id: args.surveyId },
      },
      relations: { space: true, survey: true, answeredBy: true },
    });
  }

  public async upsertResponse(args: {
    spaceId: Space['id'];
    surveyId: Survey['id'];
    answeredByUserId: User['id'];
    selections: SurveyResponseSelections;
  }): Promise<SurveyResponse> {
    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        const repo = entityManager.getRepository(DbSurveyResponse);

        const existing = await repo.findOne({
          where: {
            space: { id: args.spaceId },
            survey: { id: args.surveyId },
          },
        });

        if (existing) {
          await repo.update(existing.id, {
            selections: args.selections,
            answeredBy: { id: args.answeredByUserId },
            updatedAt: new Date(),
          });
          return await repo.findOneOrFail({
            where: { id: existing.id },
            relations: { space: true, survey: true, answeredBy: true },
          });
        }

        const insertResult = await repo.insert({
          space: { id: args.spaceId },
          survey: { id: args.surveyId },
          answeredBy: { id: args.answeredByUserId },
          selections: args.selections,
        });
        const newId = insertResult.identifiers[0].id as number;
        return await repo.findOneOrFail({
          where: { id: newId },
          relations: { space: true, survey: true, answeredBy: true },
        });
      },
    );
  }
}

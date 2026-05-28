// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable, NotFoundException } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { Survey as DbSurvey } from '@/modules/surveys/datasources/entities/survey.entity.db';
import { SurveyResponse as DbSurveyResponse } from '@/modules/surveys/datasources/entities/survey-response.entity.db';
import type { Survey } from '@/modules/surveys/domain/entities/survey.entity';
import type {
  SurveyResponse,
  SurveyResponseSelections,
} from '@/modules/surveys/domain/entities/survey-response.entity';
import type {
  ISurveysRepository,
  UpsertedSurveyResponse,
} from '@/modules/surveys/domain/surveys.repository.interface';
import type { User } from '@/modules/users/domain/entities/user.entity';

@Injectable()
export class SurveysRepository implements ISurveysRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async findActiveBySlug(slug: Survey['slug']): Promise<Survey | null> {
    const repo = await this.postgresDatabaseService.getRepository(DbSurvey);
    return await repo.findOne({
      where: { slug, isActive: true },
    });
  }

  public async findActiveBySlugOrFail(slug: Survey['slug']): Promise<Survey> {
    const survey = await this.findActiveBySlug(slug);
    if (!survey) {
      throw new NotFoundException(`No active survey for slug "${slug}".`);
    }
    return survey;
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

  /**
   * Atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING — single round-trip.
   * On conflict only the mutable columns are overwritten; submitted_at stays
   * pinned to the original INSERT time, and updated_at is bumped by the
   * `update_updated_at` trigger.
   */
  public async upsertResponse(args: {
    spaceId: Space['id'];
    surveyId: Survey['id'];
    answeredByUserId: User['id'];
    selections: SurveyResponseSelections;
  }): Promise<UpsertedSurveyResponse> {
    const repo =
      await this.postgresDatabaseService.getRepository(DbSurveyResponse);
    const result = await repo
      .createQueryBuilder()
      .insert()
      .values({
        space: { id: args.spaceId },
        survey: { id: args.surveyId },
        answeredBy: { id: args.answeredByUserId },
        selections: args.selections,
      })
      .orUpdate(
        ['selections', 'answered_by_user_id'],
        ['space_id', 'survey_id'],
      )
      .returning(['id', 'submitted_at', 'updated_at'])
      .execute();

    const row = result.raw[0] as {
      id: number;
      submitted_at: Date;
      updated_at: Date;
    };
    return {
      id: row.id,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }
}

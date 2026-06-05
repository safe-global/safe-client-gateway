// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { Survey } from '@/modules/surveys/datasources/entities/survey.entity.db';
import type { SurveyResponse as DomainSurveyResponse } from '@/modules/surveys/domain/entities/survey-response.entity';
import { User } from '@/modules/users/datasources/entities/users.entity.db';

@Entity('survey_responses')
@Unique('UQ_survey_responses_space_survey', ['space', 'survey'])
export class SurveyResponse implements DomainSurveyResponse {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_survey_responses_id',
  })
  id!: number;

  @ManyToOne(
    () => Space,
    (space: Space) => space.id,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_survey_responses_space_id',
  })
  space!: Space;

  @ManyToOne(
    () => Survey,
    (survey: Survey) => survey.id,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'survey_id',
    foreignKeyConstraintName: 'FK_survey_responses_survey_id',
  })
  survey!: Survey;

  @ManyToOne(
    () => User,
    (user: User) => user.id,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({
    name: 'answered_by_user_id',
    foreignKeyConstraintName: 'FK_survey_responses_answered_by_user_id',
  })
  answeredBy!: User | null;

  @Column({ type: 'jsonb' })
  selections!: Record<string, Array<string>>;

  @Column({
    name: 'submitted_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  submittedAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type {
  Survey as DomainSurvey,
  SurveyContent,
} from '@/modules/surveys/domain/entities/survey.entity';

@Entity('surveys')
@Unique('UQ_surveys_slug_version', ['slug', 'version'])
@Index('uq_surveys_active', ['slug'], {
  unique: true,
  where: '"is_active" = true',
})
export class Survey implements DomainSurvey {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_surveys_id' })
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subtitle!: string | null;

  @Column({ name: 'survey_content', type: 'jsonb' })
  surveyContent!: SurveyContent;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  createdAt!: Date;
}

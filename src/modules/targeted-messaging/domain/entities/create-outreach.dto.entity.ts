import { z } from 'zod';
import {
  NullableCoercedDateSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { OutreachBaseSchema } from '@/modules/targeted-messaging/domain/entities/outreach.entity';

export const CreateOutreachDtoSchema = OutreachBaseSchema.extend({
  sourceFile: NullableStringSchema,
  sourceFileProcessedDate: NullableCoercedDateSchema,
  sourceFileChecksum: NullableStringSchema,
  targetAll: z.boolean(),
});

export class CreateOutreachDto implements z.infer<
  typeof CreateOutreachDtoSchema
> {
  name: string;
  startDate: Date;
  endDate: Date;
  sourceId: number;
  type: string;
  teamName: string;
  sourceFile: string | null;
  sourceFileProcessedDate: Date | null;
  sourceFileChecksum: string | null;
  targetAll: boolean;

  constructor(props: CreateOutreachDto) {
    this.name = props.name;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.sourceId = props.sourceId;
    this.type = props.type;
    this.teamName = props.teamName;
    this.sourceFile = props.sourceFile;
    this.sourceFileProcessedDate = props.sourceFileProcessedDate;
    this.sourceFileChecksum = props.sourceFileChecksum;
    this.targetAll = props.targetAll;
  }
}

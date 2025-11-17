import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { z } from 'zod';

export const UpdateOutreachDtoSchema = z.object({
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  sourceId: z
    .number()
    .int()
    .gte(1)
    .lte(DB_MAX_SAFE_INTEGER - 1),
  type: z.string(),
  teamName: z.string(),
});

export class UpdateOutreachDto
  implements z.infer<typeof UpdateOutreachDtoSchema>
{
  name: string;
  startDate: Date;
  endDate: Date;
  sourceId: number;
  type: string;
  teamName: string;

  constructor(props: UpdateOutreachDto) {
    this.name = props.name;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.sourceId = props.sourceId;
    this.type = props.type;
    this.teamName = props.teamName;
  }
}

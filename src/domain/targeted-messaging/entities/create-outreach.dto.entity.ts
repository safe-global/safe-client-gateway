import { z } from 'zod';

export const CreateOutreachDtoSchema = z.object({
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export class CreateOutreachDto
  implements z.infer<typeof CreateOutreachDtoSchema>
{
  name: string;
  startDate: Date;
  endDate: Date;

  constructor(props: CreateOutreachDto) {
    this.name = props.name;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
  }
}

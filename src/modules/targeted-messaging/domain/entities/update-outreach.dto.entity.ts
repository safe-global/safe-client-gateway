import type { OutreachBaseSchema } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import type { z } from 'zod';

export class UpdateOutreachDto implements z.infer<typeof OutreachBaseSchema> {
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

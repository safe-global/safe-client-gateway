import { z } from 'zod';
import type { TargetedSafeEntry } from '@/modules/targeted-messaging/domain/entities/targeted-safe-entry.entity';
import { TargetedSafeEntrySchema } from '@/modules/targeted-messaging/domain/entities/targeted-safe-entry.entity';

export const CreateTargetedSafesDtoSchema = z.object({
  outreachId: z.number(),
  addresses: z.array(TargetedSafeEntrySchema),
});

export class CreateTargetedSafesDto implements z.infer<
  typeof CreateTargetedSafesDtoSchema
> {
  outreachId: number;
  addresses: Array<TargetedSafeEntry>;

  constructor(props: CreateTargetedSafesDto) {
    this.outreachId = props.outreachId;
    this.addresses = props.addresses;
  }
}

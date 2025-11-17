import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { OutreachSchema } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import { TargetedSafeSchema } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type Submission = z.infer<typeof SubmissionSchema>;

export const SubmissionSchema = RowSchema.extend({
  outreachId: OutreachSchema.shape.id,
  targetedSafeId: TargetedSafeSchema.shape.id,
  signerAddress: AddressSchema,
  completionDate: z.coerce.date(),
});

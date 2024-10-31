import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreateTargetedSafesDtoSchema = z.object({
  outreachId: z.number(),
  addresses: z.array(AddressSchema),
});

export class CreateTargetedSafesDto
  implements z.infer<typeof CreateTargetedSafesDtoSchema>
{
  outreachId: number;
  addresses: Array<`0x${string}`>;

  constructor(props: CreateTargetedSafesDto) {
    this.outreachId = props.outreachId;
    this.addresses = props.addresses;
  }
}

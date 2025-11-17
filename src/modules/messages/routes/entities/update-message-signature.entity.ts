import { UpdateMessageSignatureDtoSchema } from '@/modules/messages/routes/entities/schemas/update-message-signature.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class UpdateMessageSignatureDto
  implements z.infer<typeof UpdateMessageSignatureDtoSchema>
{
  @ApiProperty()
  signature!: Address;
}

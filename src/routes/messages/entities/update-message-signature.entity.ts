import { UpdateMessageSignatureDtoSchema } from '@/routes/messages/entities/schemas/update-message-signature.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class UpdateMessageSignatureDto
  implements z.infer<typeof UpdateMessageSignatureDtoSchema>
{
  @ApiProperty()
  signature!: `0x${string}`;
}

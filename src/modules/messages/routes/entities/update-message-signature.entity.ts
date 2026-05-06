// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { UpdateMessageSignatureDtoSchema } from '@/modules/messages/routes/entities/schemas/update-message-signature.dto.schema';

export class UpdateMessageSignatureDto
  implements z.infer<typeof UpdateMessageSignatureDtoSchema>
{
  @ApiProperty()
  signature!: Address;
}

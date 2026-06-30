// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { CreateMessageDtoSchema } from '@/modules/messages/routes/entities/schemas/create-message.dto.schema';
import { TypedData } from '@/modules/messages/routes/entities/typed-data.entity';

@ApiExtraModels(TypedData)
export class CreateMessageDto
  implements z.infer<typeof CreateMessageDtoSchema>
{
  @ApiProperty({
    oneOf: [{ type: 'string' }, { $ref: getSchemaPath(TypedData) }],
  })
  message!: string | TypedData;
  /** @deprecated Send the SafeApp identity inside `origin` ({ name, url }). The server resolves it by URL; this value is accepted for backwards compatibility but ignored. */
  @ApiPropertyOptional({ type: Number, nullable: true, deprecated: true })
  safeAppId!: number | null;
  @ApiProperty()
  signature!: Address;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin!: string | null;
}

import { CreateMessageDtoSchema } from '@/routes/messages/entities/schemas/create-message.dto.schema';
import { TypedData } from '@/routes/messages/entities/typed-data.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { z } from 'zod';

@ApiExtraModels(TypedData)
export class CreateMessageDto
  implements z.infer<typeof CreateMessageDtoSchema>
{
  @ApiProperty({
    oneOf: [{ type: 'string' }, { $ref: getSchemaPath(TypedData) }],
  })
  message!: string | TypedData;
  @ApiPropertyOptional({ type: Number, nullable: true, deprecated: true })
  safeAppId!: number | null;
  @ApiProperty()
  signature!: `0x${string}`;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin!: string | null;
}

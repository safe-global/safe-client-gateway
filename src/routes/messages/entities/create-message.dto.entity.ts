import { CreateMessageDtoSchema } from '@/routes/messages/entities/schemas/create-message.dto.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class CreateMessageDto
  implements z.infer<typeof CreateMessageDtoSchema>
{
  @ApiProperty()
  message!: string | Record<string, unknown>;
  @ApiPropertyOptional({ type: Number, nullable: true })
  safeAppId!: number | null;
  @ApiProperty()
  signature!: string;
}

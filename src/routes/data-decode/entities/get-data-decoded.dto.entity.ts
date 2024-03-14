import { GetDataDecodedDtoSchema } from '@/routes/data-decode/entities/schemas/get-data-decoded.dto.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class GetDataDecodedDto
  implements z.infer<typeof GetDataDecodedDtoSchema>
{
  @ApiProperty({ description: 'Hexadecimal value' })
  data: `0x${string}`;
  @ApiPropertyOptional({ description: 'The target Ethereum address' })
  to?: `0x${string}`;

  constructor(data: `0x${string}`, to: `0x${string}`) {
    this.data = data;
    this.to = to;
  }
}

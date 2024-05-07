import { DeleteDelegateV2DtoSchema } from '@/routes/delegates/v2/entities/schemas/delete-delegate.v2.dto.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class DeleteDelegateV2Dto
  implements z.infer<typeof DeleteDelegateV2DtoSchema>
{
  @ApiPropertyOptional()
  delegator!: `0x${string}` | null;
  @ApiPropertyOptional()
  safe!: `0x${string}` | null;
  @ApiProperty()
  signature!: string;
}

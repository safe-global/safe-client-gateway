import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvalidationPatternDetails {
  @ApiPropertyOptional({ type: 'string', nullable: true })
  chain_id: string | null;
}

export class InvalidationPatternDto {
  @ApiProperty()
  invalidate: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  patternDetails: InvalidationPatternDetails | null;
}

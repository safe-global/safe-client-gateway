import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvalidationPatternDto as DomainInvalidationPatternDto } from '../../../domain/flush/entities/invalidation-pattern.dto.entity';

class InvalidationPatternDetails {
  @ApiPropertyOptional()
  chain_id?: string;
}

export class InvalidationPatternDto implements DomainInvalidationPatternDto {
  @ApiProperty()
  invalidate: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  patternDetails: InvalidationPatternDetails;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GetEstimationDto as DomainGetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import type { Address, Hex } from 'viem';

export class GetEstimationDto implements DomainGetEstimationDto {
  @ApiProperty()
  to!: Address;
  @ApiProperty()
  value!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: Hex | null;
  @ApiProperty()
  operation!: Operation;
}

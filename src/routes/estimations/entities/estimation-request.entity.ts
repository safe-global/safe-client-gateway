import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstimationRequest as DomainEstimationRequest } from '../../../domain/estimations/entities/estimation-request.entity';
import { Operation } from '../../../domain/safe/entities/operation.entity';

export class EstimationRequest implements DomainEstimationRequest {
  @ApiProperty()
  to: string;
  @ApiProperty()
  value: number;
  @ApiPropertyOptional({ type: String, nullable: true })
  data: string | null;
  @ApiProperty()
  operation: Operation;
}

import { ApiProperty } from '@nestjs/swagger';
import { Estimation as DomainEstimation } from '../../../domain/estimations/entities/estimation.entity';

export class Estimation implements DomainEstimation {
  @ApiProperty()
  safeTxGas: string;
}

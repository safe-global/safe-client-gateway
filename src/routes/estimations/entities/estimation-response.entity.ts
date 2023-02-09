import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { Estimation } from './estimation.entity';

@ApiExtraModels(Estimation)
export class EstimationResponse {
  @ApiProperty({ type: Estimation })
  estimation: Estimation;
  @ApiProperty()
  currentNonce: number;
  @ApiProperty()
  recommendedNonce: number;

  constructor(
    estimation: Estimation,
    currentNonce: number,
    recommendedNonce: number,
  ) {
    this.estimation = estimation;
    this.currentNonce = currentNonce;
    this.recommendedNonce = recommendedNonce;
  }
}

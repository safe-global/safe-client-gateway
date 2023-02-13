import { ApiProperty } from '@nestjs/swagger';

export class EstimationResponse {
  @ApiProperty()
  currentNonce: number;
  @ApiProperty()
  recommendedNonce: number;
  @ApiProperty()
  safeTxGas: string;

  constructor(
    currentNonce: number,
    recommendedNonce: number,
    safeTxGas: string,
  ) {
    this.currentNonce = currentNonce;
    this.recommendedNonce = recommendedNonce;
    this.safeTxGas = safeTxGas;
  }
}

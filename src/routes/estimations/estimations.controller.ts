import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EstimationRequest } from './entities/estimation-request.entity';
import { EstimationResponse } from './entities/estimation-response.entity';
import { EstimationsService } from './estimations.service';

@ApiTags('estimations')
@Controller({
  path: '',
  version: '2',
})
export class EstimationsController {
  constructor(private readonly estimationsService: EstimationsService) {}

  @ApiOkResponse({ type: EstimationResponse })
  @HttpCode(200)
  @Post('chains/:chainId/safes/:address/multisig-transactions/estimations')
  async getContract(
    @Param('chainId') chainId: string,
    @Param('address') address: string,
    @Body() estimationRequest: EstimationRequest,
  ): Promise<EstimationResponse> {
    return this.estimationsService.createEstimation(
      chainId,
      address,
      estimationRequest,
    );
  }
}

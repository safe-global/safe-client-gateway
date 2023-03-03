import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EstimationResponse } from './entities/estimation-response.entity';
import { GetEstimationDto } from './entities/get-estimation.dto.entity';
import { EstimationsService } from './estimations.service';
import { GetEstimationDtoValidationPipe } from './pipes/get-estimation.dto.validation.pipe';

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
    @Body(GetEstimationDtoValidationPipe) getEstimationDto: GetEstimationDto,
  ): Promise<EstimationResponse> {
    return this.estimationsService.getEstimation(
      chainId,
      address,
      getEstimationDto,
    );
  }
}

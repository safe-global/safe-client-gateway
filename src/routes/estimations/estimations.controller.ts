import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EstimationResponse } from '@/routes/estimations/entities/estimation-response.entity';
import { GetEstimationDto } from '@/routes/estimations/entities/get-estimation.dto.entity';
import { EstimationsService } from '@/routes/estimations/estimations.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { GetEstimationDtoSchema } from '@/routes/estimations/entities/schemas/get-estimation.dto.schema';

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
    @Body(new ValidationPipe(GetEstimationDtoSchema))
    getEstimationDto: GetEstimationDto,
  ): Promise<EstimationResponse> {
    return this.estimationsService.getEstimation({
      chainId,
      address,
      getEstimationDto,
    });
  }
}

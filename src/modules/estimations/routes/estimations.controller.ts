import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { EstimationResponse } from '@/modules/estimations/routes/entities/estimation-response.entity';
import { GetEstimationDto } from '@/modules/estimations/routes/entities/get-estimation.dto.entity';
import { GetEstimationDtoSchema } from '@/modules/estimations/routes/entities/schemas/get-estimation.dto.schema';
import { EstimationsService } from '@/modules/estimations/routes/estimations.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('estimations')
@Controller({
  path: '',
  version: '2',
})
export class EstimationsController {
  constructor(private readonly estimationsService: EstimationsService) {}

  @ApiOperation({
    summary: 'Estimate multisig transaction gas',
    description:
      'Estimates the gas cost for executing a multisig transaction on a Safe. Provides both the recommended gas limit and the current gas price for accurate cost calculation.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiBody({
    type: GetEstimationDto,
    description:
      'Transaction details for gas estimation including recipient, value, and data',
  })
  @ApiOkResponse({
    type: EstimationResponse,
    description:
      'Gas estimation calculated successfully with recommended values',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction parameters or estimation failed',
  })
  @HttpCode(200)
  @Post('chains/:chainId/safes/:address/multisig-transactions/estimations')
  getEstimation(
    @Param('chainId') chainId: string,
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
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

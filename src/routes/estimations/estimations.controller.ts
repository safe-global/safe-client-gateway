import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { EstimationResponse } from '@/routes/estimations/entities/estimation-response.entity';
import { GetEstimationDto } from '@/routes/estimations/entities/get-estimation.dto.entity';
import { EstimationsService } from '@/routes/estimations/estimations.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { GetEstimationDtoSchema } from '@/routes/estimations/entities/schemas/get-estimation.dto.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

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
  async getEstimation(
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

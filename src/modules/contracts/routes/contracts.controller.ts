import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { Contract } from '@/modules/contracts/domain/entities/contract.entity';
import { ContractsService } from '@/modules/contracts/routes/contracts.service';
import { Contract as ApiContract } from '@/modules/contracts/routes/entities/contract.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('contracts')
@Controller({
  path: '',
  version: '1',
})
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @ApiOperation({
    summary: 'Get contract information',
    description:
      'Retrieves detailed information about a smart contract deployed on the specified chain, including ABI, source code verification status, and contract metadata.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the contract is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'contractAddress',
    type: 'string',
    description: 'Contract address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: ApiContract,
    description: 'Contract information retrieved successfully',
  })
  @Get('chains/:chainId/contracts/:contractAddress')
  getContract(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('contractAddress', new ValidationPipe(AddressSchema))
    contractAddress: Address,
  ): Promise<Contract> {
    return this.contractsService.getContract({ chainId, contractAddress });
  }
}

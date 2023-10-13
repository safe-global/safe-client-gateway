import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ContractsService } from '@/routes/contracts/contracts.service';
import { Contract as ApiContract } from '@/routes/contracts/entities/contract.entity';

@ApiTags('contracts')
@Controller({
  path: '',
  version: '1',
})
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @ApiOkResponse({ type: ApiContract })
  @Get('chains/:chainId/contracts/:contractAddress')
  async getContract(
    @Param('chainId') chainId: string,
    @Param('contractAddress') contractAddress: string,
  ): Promise<Contract> {
    return this.contractsService.getContract({ chainId, contractAddress });
  }
}

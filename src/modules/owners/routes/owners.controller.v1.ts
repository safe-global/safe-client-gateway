import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { SafeList } from '@/modules/owners/routes/entities/safe-list.entity';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('owners')
@Controller({
  path: '',
  version: '1',
})
export class OwnersControllerV1 {
  constructor(private readonly ownersService: OwnersService) {}

  @ApiOperation({
    summary: 'Get Safes by owner',
    description:
      'Retrieves a list of Safe addresses that are owned by the specified address on a specific chain.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID to search for Safes',
    example: '1',
  })
  @ApiParam({
    name: 'ownerAddress',
    type: 'string',
    description: 'Owner address to search Safes for (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: SafeList,
    description: 'List of Safes owned by the specified address',
  })
  @Get('chains/:chainId/owners/:ownerAddress/safes')
  async getSafesByOwner(
    @Param('chainId') chainId: string,
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: Address,
  ): Promise<SafeList> {
    return this.ownersService.getSafesByOwner({ chainId, ownerAddress });
  }

  @ApiOperation({
    deprecated: true,
    summary: 'Get all Safes by owner (deprecated)',
    description:
      'Retrieves Safes owned by an address across all chains. This endpoint is deprecated, please use the chain-specific version instead.',
  })
  @ApiParam({
    name: 'ownerAddress',
    type: 'string',
    description: 'Owner address to search Safes for (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: SafeList,
    description: 'Map of chain IDs to arrays of Safe addresses',
  })
  @Get('owners/:ownerAddress/safes')
  async getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: Address,
  ): Promise<{ [chainId: string]: Array<string> }> {
    return this.ownersService.deprecated__getAllSafesByOwner({ ownerAddress });
  }
}

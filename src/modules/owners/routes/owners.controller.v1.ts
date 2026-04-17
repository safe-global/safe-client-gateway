// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { SafeList } from '@/modules/owners/routes/entities/safe-list.entity';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

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
  getSafesByOwner(
    @Param('chainId') chainId: string,
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: Address,
  ): Promise<SafeList> {
    return this.ownersService.getSafesByOwner({ chainId, ownerAddress });
  }
}

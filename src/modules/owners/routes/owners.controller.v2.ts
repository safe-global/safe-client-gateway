import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import { type SafesByChainId } from '@/modules/safe/domain/entities/safes-by-chain-id.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('owners')
@Controller({
  path: '',
  version: '2',
})
export class OwnersControllerV2 {
  constructor(private readonly ownersService: OwnersService) {}

  @ApiOperation({
    summary: 'Get all Safes by owner',
    description:
      'Retrieves all Safes owned by the specified address across all supported chains. Returns a map of chain IDs to arrays of Safe addresses.',
  })
  @ApiParam({
    name: 'ownerAddress',
    type: 'string',
    description: 'Owner address to search Safes for (0x prefixed hex string)',
  })
  @ApiOkResponse({
    description:
      'Map of chain IDs to arrays of Safe addresses owned by the address',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
      example: {
        '1': ['0x1234567890123456789012345678901234567890'],
        '5': ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
      },
    },
  })
  @Get('owners/:ownerAddress/safes')
  async getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: Address,
  ): Promise<SafesByChainId> {
    return this.ownersService.getAllSafesByOwner({ ownerAddress });
  }
}

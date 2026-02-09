import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { SafesByChainIdV3 } from '@/modules/safe/domain/entities/safes-by-chain-id-v3.entity';
import type { Address } from 'viem';

@ApiTags('owners')
@Controller({
  path: '',
  version: '3',
})
export class OwnersControllerV3 {
  constructor(private readonly ownersService: OwnersService) {}

  @ApiOperation({
    summary: 'Get all Safes by owner',
    description:
      'Retrieves all Safes owned by the specified address across all supported chains. Returns a map of chain IDs to maps of Safe addresses to Safe objects.',
  })
  @ApiParam({
    name: 'ownerAddress',
    type: 'string',
    description: 'Owner address to search Safes for (0x prefixed hex string)',
  })
  @ApiOkResponse({
    description:
      'Map of chain IDs to maps of Safe addresses to Safe objects owned by the address',
    schema: {
      type: 'object',
      additionalProperties: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                nonce: { type: 'number' },
                threshold: { type: 'number' },
                owners: {
                  type: 'array',
                  items: { type: 'string' },
                },
                masterCopy: { type: 'string' },
                fallbackHandler: { type: 'string' },
                guard: { type: 'string', nullable: true },
                moduleGuard: { type: 'string', nullable: true },
                enabledModules: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: [
                'address',
                'nonce',
                'threshold',
                'owners',
                'masterCopy',
                'fallbackHandler',
                'enabledModules',
              ],
            },
          },
          { type: 'null' },
        ],
      },
      example: {
        '1': {
          '0x1234567890123456789012345678901234567890': {
            address: '0x1234567890123456789012345678901234567890',
            nonce: 0,
            threshold: 2,
            owners: [
              '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
            ],
            masterCopy: '0x0000000000000000000000000000000000000000',
            fallbackHandler: '0x0000000000000000000000000000000000000000',
            guard: null,
            moduleGuard: null,
            enabledModules: [],
          },
        },
        '5': {
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': {
            address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            nonce: 1,
            threshold: 1,
            owners: ['0x1234567890123456789012345678901234567890'],
            masterCopy: '0x0000000000000000000000000000000000000000',
            fallbackHandler: '0x0000000000000000000000000000000000000000',
            guard: null,
            moduleGuard: null,
            enabledModules: [],
          },
        },
      },
    },
  })
  @Get('owners/:ownerAddress/safes')
  async getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: Address,
  ): Promise<SafesByChainIdV3> {
    return this.ownersService.getAllSafesByOwnerV3({ ownerAddress });
  }
}

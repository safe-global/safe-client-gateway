import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SafeList } from '@/routes/owners/entities/safe-list.entity';
import { OwnersService } from '@/routes/owners/owners.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('owners')
@Controller({
  path: '',
})
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @ApiOkResponse({ type: SafeList })
  @Get('/v1/chains/:chainId/owners/:ownerAddress/safes')
  async getSafesByOwner(
    @Param('chainId') chainId: string,
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: `0x${string}`,
  ): Promise<SafeList> {
    return this.ownersService.getSafesByOwner({ chainId, ownerAddress });
  }

  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  })
  @ApiOperation({ deprecated: true })
  @Get('/v1/owners/:ownerAddress/safes')
  async deprecated__getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: `0x${string}`,
  ): Promise<{ [chainId: string]: Array<string> }> {
    return this.ownersService.deprecated__getAllSafesByOwner({ ownerAddress });
  }

  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
        nullable: true,
      },
    },
  })
  @Get('/v2/owners/:ownerAddress/safes')
  async getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: `0x${string}`,
  ): Promise<{ [chainId: string]: Array<string> | null }> {
    return this.ownersService.getAllSafesByOwner({ ownerAddress });
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OwnersService } from '@/routes/owners/owners.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('owners')
@Controller({
  path: '',
  version: '2',
})
export class OwnersControllerV2 {
  constructor(private readonly ownersService: OwnersService) {}

  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  })
  @Get('owners/:ownerAddress/safes')
  async getAllSafesByOwner(
    @Param('ownerAddress', new ValidationPipe(AddressSchema))
    ownerAddress: `0x${string}`,
  ): Promise<{ [chainId: string]: Array<string> | null }> {
    return this.ownersService.getAllSafesByOwner({ ownerAddress });
  }
}

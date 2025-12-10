import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { SafeOverview } from '@/modules/safe/routes/entities/safe-overview.entity';
import {
  Caip10AddressesSchema,
  type Caip10Addresses,
} from '@/modules/safe/routes/entities/caip-10-addresses.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';
import { SafesV2Service } from './safes.v2.service';

@ApiTags('safes')
@Controller({
  version: '2',
})
export class SafesV2Controller {
  constructor(private readonly service: SafesV2Service) {}

  @ApiOperation({
    summary: 'Get Safe overview (v2)',
    description:
      'Retrieves an overview of multiple Safes. Supports cross-chain queries using chainId:address format.',
  })
  @ApiQuery({
    name: 'currency',
    required: true,
    type: String,
    description: 'Fiat currency code for balance conversion (e.g., USD, EUR)',
    example: 'USD',
  })
  @ApiQuery({
    name: 'safes',
    required: true,
    type: String,
    description:
      'Comma-separated list of Safe addresses in chainId:address format',
    example:
      '1:0x1234567890123456789012345678901234567890,5:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  })
  @ApiQuery({
    name: 'wallet_address',
    required: false,
    type: String,
    description:
      'Optional wallet address to filter Safes where this address is an owner',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description:
      'If true, only includes trusted tokens in balance calculations. Note: This parameter only applies to chains not using Zerion portfolio data. For Zerion-enabled chains, all positions are included.',
    example: false,
  })
  @ApiQuery({
    name: 'exclude_spam',
    required: false,
    type: Boolean,
    description:
      'If true, excludes spam tokens from balance calculations. Note: This parameter only applies to chains not using Zerion portfolio data. For Zerion-enabled chains, all positions are included.',
    example: true,
  })
  @ApiOkResponse({
    type: SafeOverview,
    isArray: true,
    description: 'Array of Safe overviews with balances and metadata',
  })
  @Get('safes')
  async getSafeOverview(
    @Query('currency') currency: string,
    @Query('safes', new ValidationPipe(Caip10AddressesSchema))
    addresses: Caip10Addresses,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
    @Query('wallet_address', new ValidationPipe(AddressSchema.optional()))
    walletAddress?: Address,
  ): Promise<Array<SafeOverview>> {
    return this.service.getSafeOverview({
      currency,
      addresses,
      trusted,
      excludeSpam,
      walletAddress,
    });
  }
}

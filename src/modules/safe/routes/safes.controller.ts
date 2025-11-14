import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { SafeState } from '@/modules/safe/routes/entities/safe-info.entity';
import { SafesService } from '@/modules/safe/routes/safes.service';
import { SafeNonces } from '@/modules/safe/routes/entities/nonces.entity';
import { SafeOverview } from '@/modules/safe/routes/entities/safe-overview.entity';
import {
  Caip10AddressesSchema,
  type Caip10Addresses,
} from '@/modules/safe/routes/entities/caip-10-addresses.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('safes')
@Controller({
  version: '1',
})
export class SafesController {
  constructor(private readonly service: SafesService) {}

  @ApiOperation({
    summary: 'Get Safe information',
    description:
      'Retrieves detailed information about a Safe including owners, threshold, modules, and current state.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: SafeState,
    description: 'Safe information retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Safe not found on the specified chain',
  })
  @Get('chains/:chainId/safes/:safeAddress')
  async getSafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<SafeState> {
    return this.service.getSafeInfo({ chainId, safeAddress });
  }

  @ApiOperation({
    summary: 'Get Safe nonces',
    description:
      'Retrieves the current nonces for a Safe, including the transaction nonce and any queued nonces.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: SafeNonces,
    description: 'Safe nonces retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Safe not found on the specified chain',
  })
  @Get('chains/:chainId/safes/:safeAddress/nonces')
  async getNonces(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<SafeNonces> {
    return this.service.getNonces({ chainId, safeAddress });
  }

  @ApiOperation({
    summary: 'Get Safe overview',
    description:
      'Retrieves an overview of multiple Safes including their balances, transaction counts, and other summary information. Supports cross-chain queries using CAIP-10 address format.',
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
      'Comma-separated list of Safe addresses in CAIP-10 format (chainId:address)',
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
      'If true, only includes trusted tokens in balance calculations',
    example: false,
  })
  @ApiQuery({
    name: 'exclude_spam',
    required: false,
    type: Boolean,
    description: 'If true, excludes spam tokens from balance calculations',
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

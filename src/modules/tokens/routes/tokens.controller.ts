// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import type { Token } from '@/modules/tokens/domain/entities/token.entity';
import {
  Erc20TokenMetadata,
  Erc721TokenMetadata,
  NativeTokenMetadata,
} from '@/modules/tokens/routes/entities/token.dto.entity';
import {
  MAX_TOKEN_ADDRESSES,
  type TokenAddresses,
  TokenAddressesSchema,
} from '@/modules/tokens/routes/entities/token-addresses.dto.entity';
import { TokensRateLimitGuard } from '@/modules/tokens/routes/guards/tokens-rate-limit.guard';
import { TokensService } from '@/modules/tokens/routes/tokens.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

const TOKEN_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(NativeTokenMetadata) },
    { $ref: getSchemaPath(Erc20TokenMetadata) },
    { $ref: getSchemaPath(Erc721TokenMetadata) },
  ],
};

@ApiTags('tokens')
// Unauthenticated lookups: the batch route fans out one request into up to
// MAX_TOKEN_ADDRESSES upstream calls, so it carries its own per-caller bound.
@UseGuards(TokensRateLimitGuard)
@ApiExtraModels(NativeTokenMetadata, Erc20TokenMetadata, Erc721TokenMetadata)
@Controller({
  path: '',
  version: '1',
})
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @ApiOperation({
    summary: 'Get token metadata',
    description:
      'Symbol, name, decimals, logo and trust flag of a token on the given chain, as known by the Transaction Service.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID the token is deployed on',
    example: '1',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Token contract address (0x prefixed hex string)',
  })
  @ApiOkResponse({ schema: TOKEN_SCHEMA, description: 'Token metadata' })
  @ApiNotFoundResponse({
    description: 'The Transaction Service does not know this token',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid chain ID or address',
  })
  @Get('chains/:chainId/tokens/:address')
  getToken(
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
  ): Promise<Token> {
    return this.tokensService.getToken({ chainId, address });
  }

  @ApiOperation({
    summary: 'Get metadata for several tokens',
    description: `Metadata for up to ${MAX_TOKEN_ADDRESSES} tokens of one chain, in request order. Addresses the Transaction Service does not know are omitted.`,
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID the token is deployed on',
    example: '1',
  })
  @ApiQuery({
    name: 'addresses',
    type: 'string',
    description: `Comma-separated token contract addresses, at most ${MAX_TOKEN_ADDRESSES}`,
    example:
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,0xdAC17F958D2ee523a2206206994597C13D831ec7',
  })
  @ApiOkResponse({
    schema: { type: 'array', items: TOKEN_SCHEMA },
    description: 'Token metadata for the known addresses, in request order',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiUnprocessableEntityResponse({
    description: `Invalid chain ID, malformed address, empty list or more than ${MAX_TOKEN_ADDRESSES} addresses`,
  })
  @Get('chains/:chainId/tokens')
  getTokens(
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Query('addresses', new ValidationPipe(TokenAddressesSchema))
    addresses: TokenAddresses,
  ): Promise<Array<Token>> {
    return this.tokensService.getTokens({ chainId, addresses });
  }
}

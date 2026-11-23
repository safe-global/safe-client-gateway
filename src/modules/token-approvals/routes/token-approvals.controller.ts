// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import { TokenApprovalsDto } from '#/modules/token-approvals/routes/entities/token-approvals.dto.entity';
import { TokenApprovalsRateLimitGuard } from '#/modules/token-approvals/routes/guards/token-approvals-rate-limit.guard';
import { TokenApprovalsService } from '#/modules/token-approvals/routes/token-approvals.service';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('token-approvals')
@Controller({
  path: '',
  version: '1',
})
export class TokenApprovalsController {
  constructor(private readonly tokenApprovalsService: TokenApprovalsService) {}

  @ApiOperation({
    summary: 'Get the token approvals of a Safe',
    description:
      'Lists every ERC-20 allowance of the Safe that is above zero, however it was given. The token and spender pairs come from the Approval logs that name the Safe as owner, read over the chain RPC, and each allowance is read on chain at the latest block. `isComplete` is false while the logs are not read up to the latest block, or when the list reached its size limit; a later request continues the scan.',
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
    description: 'Safe address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: TokenApprovalsDto,
    description: 'Token approvals retrieved successfully',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid chain ID or Safe address',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit reached' })
  @ApiServiceUnavailableResponse({
    description: 'The chain could not be read',
  })
  @UseGuards(TokenApprovalsRateLimitGuard)
  @Get('chains/:chainId/safes/:safeAddress/token-approvals')
  getTokenApprovals(
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<TokenApprovalsDto> {
    return this.tokenApprovalsService.getTokenApprovals({
      chainId,
      safeAddress,
    });
  }
}

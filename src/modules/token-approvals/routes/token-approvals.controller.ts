// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import { TokenApprovals } from '#/modules/token-approvals/routes/entities/token-approvals.entity';
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
      "Lists the ERC-20 allowances a Safe has given that are still above zero. The token and spender pairs are found in the Safe's executed multisig and module transactions, and each allowance is read on-chain. Approvals signed off-chain (EIP-2612 permit, Permit2) are not listed.",
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
    type: TokenApprovals,
    description: 'Token approvals retrieved successfully',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid chain ID or Safe address',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit reached' })
  @UseGuards(TokenApprovalsRateLimitGuard)
  @Get('chains/:chainId/safes/:safeAddress/token-approvals')
  getTokenApprovals(
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<TokenApprovals> {
    return this.tokenApprovalsService.getTokenApprovals({
      chainId,
      safeAddress,
    });
  }
}

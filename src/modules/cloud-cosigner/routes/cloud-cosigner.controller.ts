// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import { CloudCosignerService } from '@/modules/cloud-cosigner/routes/cloud-cosigner.service';
import {
  CloudCosignerInfoDto,
  SafeCloudCosignerStatusDto,
} from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-info.dto.entity';
import {
  CloudCosignerPolicyDto,
  UpdateCloudCosignerPolicyDto,
  UpdateCloudCosignerPolicySchema,
} from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-policy.dto.entity';
import { CloudCosignerReviewDto } from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-review.dto.entity';
import { CloudCosignerRateLimitGuard } from '@/modules/cloud-cosigner/routes/guards/cloud-cosigner-rate-limit.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('cloud-cosigner')
@Controller({ path: '', version: '1' })
@UseGuards(CloudCosignerRateLimitGuard)
export class CloudCosignerController {
  constructor(
    @Inject(CloudCosignerService)
    private readonly service: CloudCosignerService,
  ) {}

  @ApiOperation({
    summary: 'Get the cloud cosigner address and default policy',
    description:
      'Adding the returned address as an owner of a Safe enables the cloud cosigner for it.',
  })
  @ApiOkResponse({ type: CloudCosignerInfoDto })
  @Get('cloud-cosigner')
  getInfo(): Promise<CloudCosignerInfoDto> {
    return this.service.getInfo();
  }

  @ApiOperation({
    summary: 'Get the cloud cosigner status and policy of a Safe',
  })
  @ApiParam({ name: 'chainId', type: 'string', description: 'Chain ID' })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Checksummed Safe address',
  })
  @ApiOkResponse({ type: SafeCloudCosignerStatusDto })
  @Get('chains/:chainId/safes/:safeAddress/cloud-cosigner')
  getSafeStatus(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<SafeCloudCosignerStatusDto> {
    return this.service.getSafeStatus({ chainId, safeAddress });
  }

  @ApiOperation({
    summary: 'Set the cloud cosigner policy of a Safe',
    description:
      'The body carries an EIP-191 signature by a current owner over the canonical policy message, issued within the configured freshness window.',
  })
  @ApiParam({ name: 'chainId', type: 'string', description: 'Chain ID' })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Checksummed Safe address',
  })
  @ApiBody({ type: UpdateCloudCosignerPolicyDto })
  @ApiOkResponse({ type: CloudCosignerPolicyDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired signature' })
  @ApiForbiddenResponse({ description: 'Signer is not an owner of the Safe' })
  @Put('chains/:chainId/safes/:safeAddress/cloud-cosigner/policy')
  updatePolicy(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(UpdateCloudCosignerPolicySchema))
    body: z.infer<typeof UpdateCloudCosignerPolicySchema>,
  ): Promise<CloudCosignerPolicyDto> {
    return this.service.updatePolicy({ chainId, safeAddress, body });
  }

  @ApiOperation({
    summary: 'Get the cloud cosigner review of a proposed transaction',
  })
  @ApiParam({ name: 'chainId', type: 'string', description: 'Chain ID' })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Checksummed Safe address',
  })
  @ApiParam({
    name: 'safeTxHash',
    type: 'string',
    description: 'Safe transaction hash',
  })
  @ApiOkResponse({ type: CloudCosignerReviewDto })
  @ApiNotFoundResponse({ description: 'No review for this transaction' })
  @Get('chains/:chainId/safes/:safeAddress/cloud-cosigner/reviews/:safeTxHash')
  getReview(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    _safeAddress: Address,
    @Param('safeTxHash', new ValidationPipe(HexSchema)) safeTxHash: Hex,
  ): Promise<CloudCosignerReviewDto> {
    return this.service.getReview({ chainId, safeTxHash });
  }
}

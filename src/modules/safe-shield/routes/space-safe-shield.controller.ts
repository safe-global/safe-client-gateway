// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { FeatureNotGrantedExceptionFilter } from '@/modules/entitlements/domain/exception-filters/feature-not-granted.exception-filter';
import { CounterpartyAnalysisRequestSchema } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { CounterpartyAnalysisDto } from '@/modules/safe-shield/entities/dtos/counterparty-analysis.dto';
import { CounterpartyAnalysisRequestDto } from '@/modules/safe-shield/entities/dtos/counterparty-analysis-request.dto';
import { SingleRecipientAnalysisDto } from '@/modules/safe-shield/entities/dtos/single-recipient-analysis.dto';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { Auth } from '@/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '@/routes/common/pipes/space-id.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { SpaceSafeShieldService } from './space-safe-shield.service';

@ApiTags('safe-shield')
@Controller({
  path: 'spaces/:spaceId/chains/:chainId/security/:safeAddress',
  version: '1',
})
@UseGuards(AuthGuard)
@UseFilters(FeatureNotGrantedExceptionFilter)
export class SpaceSafeShieldController {
  public constructor(
    private readonly spaceSafeShieldService: SpaceSafeShieldService,
  ) {}

  @ApiOperation({
    summary: 'Analyze recipient address on a Space',
    description:
      'Performs real-time security analysis of a recipient address for a Safe registered to a Space, gated by the copilot_scans plan entitlement.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address, must be registered to the Space',
  })
  @ApiParam({
    name: 'recipientAddress',
    type: 'string',
    description: 'Recipient address to analyze',
  })
  @ApiOkResponse({
    description: 'Recipient interaction analysis results',
    type: SingleRecipientAnalysisDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Not a member of this Space, or the Safe is not registered to it',
  })
  @ApiResponse({
    status: HttpStatus.PAYMENT_REQUIRED,
    description:
      'The Space has no copilot_scans entitlement. The body carries `{ code: "FEATURE_NOT_GRANTED", feature }`',
  })
  @HttpCode(HttpStatus.OK)
  @Get('recipient/:recipientAddress')
  public analyzeRecipient(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('recipientAddress', new ValidationPipe(AddressSchema))
    recipientAddress: Address,
    @Auth() authPayload: AuthPayload,
  ): Promise<SingleRecipientAnalysisDto> {
    return this.spaceSafeShieldService.analyzeRecipient({
      spaceId,
      chainId,
      safeAddress,
      recipientAddress,
      authPayload,
    });
  }

  @ApiOperation({
    summary: 'Analyze transaction counterparties on a Space',
    description:
      'Performs combined contract and recipient analysis for a Safe transaction on a Safe registered to a Space, gated by the copilot_scans plan entitlement.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address, must be registered to the Space',
  })
  @ApiBody({
    type: CounterpartyAnalysisRequestDto,
    required: true,
    description:
      'Transaction data used to analyze all counterparties involved.',
  })
  @ApiOkResponse({
    type: CounterpartyAnalysisDto,
    description:
      'Combined counterparty analysis including recipients and contracts grouped by status group and mapped to an address.',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Not a member of this Space, or the Safe is not registered to it',
  })
  @ApiResponse({
    status: HttpStatus.PAYMENT_REQUIRED,
    description:
      'The Space has no copilot_scans entitlement. The body carries `{ code: "FEATURE_NOT_GRANTED", feature }`',
  })
  @HttpCode(HttpStatus.OK)
  @Post('counterparty-analysis')
  public analyzeCounterparty(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(CounterpartyAnalysisRequestSchema))
    txData: CounterpartyAnalysisRequestDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CounterpartyAnalysisDto> {
    return this.spaceSafeShieldService.analyzeCounterparty({
      spaceId,
      chainId,
      safeAddress,
      tx: txData,
      authPayload,
    });
  }
}

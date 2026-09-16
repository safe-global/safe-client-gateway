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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { QuotaExceededExceptionFilter } from '@/modules/entitlements/domain/exception-filters/quota-exceeded.exception-filter';
import { CopilotScansGuard } from '@/modules/entitlements/routes/guards/copilot-scans.guard';
import { CounterpartyAnalysisRequestSchema } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { CounterpartyAnalysisDto } from '@/modules/safe-shield/entities/dtos/counterparty-analysis.dto';
import { CounterpartyAnalysisRequestDto } from '@/modules/safe-shield/entities/dtos/counterparty-analysis-request.dto';
import { SingleRecipientAnalysisDto } from '@/modules/safe-shield/entities/dtos/single-recipient-analysis.dto';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { SpaceSafeShieldService } from './space-safe-shield.service';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/chains/:chainId/security/:safeAddress',
  version: '1',
})
@UseGuards(AuthGuard)
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
  @ApiResponse({
    status: HttpStatus.PAYMENT_REQUIRED,
    description:
      'The Space has no copilot_scans entitlement. The body carries `{ code: "QUOTA_EXCEEDED", feature, quota, used, resetsAt }`',
  })
  @UseGuards(CopilotScansGuard)
  @UseFilters(QuotaExceededExceptionFilter)
  @HttpCode(HttpStatus.OK)
  @Get('recipient/:recipientAddress')
  public analyzeRecipient(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
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
  @ApiResponse({
    status: HttpStatus.PAYMENT_REQUIRED,
    description:
      'The Space has no copilot_scans entitlement. The body carries `{ code: "QUOTA_EXCEEDED", feature, quota, used, resetsAt }`',
  })
  @UseGuards(CopilotScansGuard)
  @UseFilters(QuotaExceededExceptionFilter)
  @HttpCode(HttpStatus.OK)
  @Post('counterparty-analysis')
  public analyzeCounterparty(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
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
      authPayload,
      tx: txData,
    });
  }
}

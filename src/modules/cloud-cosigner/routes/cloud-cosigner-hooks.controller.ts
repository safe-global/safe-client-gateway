// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CloudCosignerService } from '@/modules/cloud-cosigner/routes/cloud-cosigner.service';
import {
  type CloudCosignerHookEvent,
  CloudCosignerHookEventDto,
  CloudCosignerHookEventSchema,
} from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-hook-event.dto.entity';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

/**
 * HTTP alternative to the AMQP subscription, mirroring the gateway's
 * `POST /hooks/events`: the Transaction Service (or an operator) can push a
 * proposal event straight to the cosigner deployable. Not rate limited by
 * client IP like the owner-facing routes, since a webhook sender is one IP.
 */
@ApiTags('cloud-cosigner')
@Controller({ path: 'cloud-cosigner/hooks', version: '1' })
export class CloudCosignerHooksController {
  constructor(
    @Inject(CloudCosignerService)
    private readonly service: CloudCosignerService,
  ) {}

  @ApiOperation({
    summary: 'Receive a Transaction Service event',
    description:
      'Queues a review for PENDING_MULTISIG_TRANSACTION events and ignores every other type. Requires the service basic-auth token.',
  })
  @ApiBody({ type: CloudCosignerHookEventDto })
  @ApiAcceptedResponse({ description: 'Event accepted' })
  @ApiForbiddenResponse({ description: 'Missing or invalid basic-auth token' })
  @UseGuards(BasicAuthGuard)
  @Post('events')
  @HttpCode(202)
  postEvent(
    @Body(new ValidationPipe(CloudCosignerHookEventSchema))
    event: CloudCosignerHookEvent,
  ): Promise<void> {
    return this.service.onEvent(event);
  }
}

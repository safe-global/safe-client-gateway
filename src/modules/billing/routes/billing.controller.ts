// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { SubscriptionStatusFilter } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatusFilterSchema } from '@/datasources/billing-api/entities/subscription.entity';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import { WebhookEventSchema } from '@/modules/billing/domain/entities/webhook-event.entity';
import { BillingService } from '@/modules/billing/routes/billing.service';
import { CheckoutSession } from '@/modules/billing/routes/entities/checkout-session.entity';
import { CheckoutSessionResult } from '@/modules/billing/routes/entities/checkout-session-result.entity';
import { PaymentLink } from '@/modules/billing/routes/entities/payment-link.entity';
import { Plan } from '@/modules/billing/routes/entities/plan.entity';
import { Subscription } from '@/modules/billing/routes/entities/subscription.entity';
import { UrlResponse } from '@/modules/billing/routes/entities/url.entity';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

const ReturnUrlSchema = z.url();
const opaqueIdPipe = new ValidationPipe(
  z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9_-]+$/),
);

@ApiTags('billing')
@Controller({
  path: 'billing',
  version: '1',
})
export class BillingController {
  public constructor(private readonly billingService: BillingService) {}

  @ApiExcludeEndpoint()
  @UseGuards(BillingWebhookAuthGuard)
  @Post('/webhooks')
  @HttpCode(202)
  public async postWebhook(
    @Body(new ValidationPipe(WebhookEventSchema)) payload: WebhookEvent,
  ): Promise<void> {
    // Origin is authenticated by BillingWebhookAuthGuard. A malformed body
    // 422s here like any other piped input; a well-formed-but-unprocessable
    // event (unknown space, `api` customer group) is acked further down in
    // SubscriptionSyncService.handleWebhook, since retrying that cannot help.
    await this.billingService.processWebhook(payload);
  }

  @ApiOperation({ summary: 'Get a space subscriptions' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: Subscription, isArray: true })
  @ApiQuery({ name: 'status', required: false })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/subscriptions')
  public async getSubscriptions(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
    @Query(
      'status',
      new ValidationPipe(SubscriptionStatusFilterSchema.optional()),
    )
    status?: SubscriptionStatusFilter,
  ): Promise<Array<Subscription>> {
    return await this.billingService.getSubscriptions({
      spaceId,
      spaceUuid,
      authPayload,
      status,
    });
  }

  @ApiOperation({ summary: 'Get a plan by id' })
  @ApiOkResponse({ type: Plan })
  @UseGuards(AuthGuard)
  @Get('/plans/:planId')
  public async getPlan(
    @Param('planId', opaqueIdPipe) planId: string,
  ): Promise<Plan> {
    return await this.billingService.getPlan(planId);
  }

  @ApiOperation({ summary: 'Get the billing portal session URL for a space' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: UrlResponse })
  @ApiQuery({ name: 'returnUrl', required: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/session-url')
  public async getSessionUrl(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
    @Query('returnUrl', new ValidationPipe(ReturnUrlSchema)) returnUrl: string,
  ): Promise<UrlResponse> {
    return await this.billingService.getSessionUrl({
      spaceId,
      spaceUuid,
      authPayload,
      returnUrl,
    });
  }

  @ApiOperation({
    summary: 'Get payment links for a space, plus the general catalog',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: PaymentLink, isArray: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/payment-links')
  public async getSpacePaymentLinks(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<PaymentLink>> {
    return await this.billingService.getSpacePaymentLinks({
      spaceId,
      spaceUuid,
      authPayload,
    });
  }

  @ApiOperation({ summary: 'Create a checkout session for a payment link' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'paymentLinkId',
    type: 'string',
    description: 'Payment link identifier',
  })
  @ApiOkResponse({ type: CheckoutSessionResult })
  @ApiQuery({ name: 'returnUrl', required: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/payment-links/:paymentLinkId/checkout-url')
  public async getCheckoutUrl(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Param('paymentLinkId', opaqueIdPipe) paymentLinkId: string,
    @Auth() authPayload: AuthPayload,
    @Query('returnUrl', new ValidationPipe(ReturnUrlSchema)) returnUrl: string,
  ): Promise<CheckoutSessionResult> {
    return await this.billingService.createCheckoutUrl({
      paymentLinkId,
      spaceId,
      spaceUuid,
      authPayload,
      returnUrl,
    });
  }

  @ApiOperation({ summary: 'Get a checkout session by id' })
  @ApiOkResponse({ type: CheckoutSession })
  @UseGuards(AuthGuard)
  @Get('/sessions/:sessionId')
  public async getCheckoutSession(
    @Param('sessionId', opaqueIdPipe) sessionId: string,
  ): Promise<CheckoutSession> {
    return await this.billingService.getCheckoutSession(sessionId);
  }
}
